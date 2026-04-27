"""GitHub GraphQL + REST client.

Single source of truth for all GitHub access. Caches reads in Redis to stay
well under the 5000 req/hr GraphQL rate limit.
"""
from __future__ import annotations

import asyncio
import base64
from typing import Any, Literal

import httpx

from app.services.cache import cache_key, get_json, set_json
from app.services.eval_log import log_github_write

GRAPHQL_URL = "https://api.github.com/graphql"
REST_URL = "https://api.github.com"

DEFAULT_TTL = 60 * 60  # 1h


class GitHubWriteError(RuntimeError):
    """GitHub write call failed. Exposes status + response body."""

    def __init__(self, status: int, body: Any, message: str):
        super().__init__(message)
        self.status = status
        self.body = body


class ForkNameCollision(GitHubWriteError):
    """User already has a repo with the fork name, but it's not a fork of the upstream."""


class GitHubClient:
    def __init__(self, token: str) -> None:
        if not token:
            raise ValueError("GitHub token required")
        self._token = token
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def graphql(
        self,
        query: str,
        variables: dict[str, Any] | None = None,
        ttl: int = DEFAULT_TTL,
    ) -> dict[str, Any]:
        key = cache_key("gh:gql", {"q": query, "v": variables or {}})
        cached = await get_json(key)
        if cached is not None:
            return cached

        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                GRAPHQL_URL,
                json={"query": query, "variables": variables or {}},
                headers=self._headers,
            )
            res.raise_for_status()
            data = res.json()
            if "errors" in data:
                raise RuntimeError(f"GitHub GraphQL errors: {data['errors']}")

        await set_json(key, data, ttl)
        return data

    async def rest(self, path: str, ttl: int = DEFAULT_TTL) -> Any:
        key = cache_key("gh:rest", path)
        cached = await get_json(key)
        if cached is not None:
            return cached

        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.get(f"{REST_URL}{path}", headers=self._headers)
            res.raise_for_status()
            data = res.json()

        await set_json(key, data, ttl)
        return data

    async def rest_raw(
        self,
        method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"],
        path: str,
        json: dict[str, Any] | None = None,
    ) -> tuple[int, Any]:
        """Uncached REST call for writes and freshness-critical reads.

        Returns (status, parsed_body). Does not raise on non-2xx — the caller
        decides whether 4xx is an error or a known branching condition
        (e.g. 422 on `create_or_update_ref` means "already exists, PATCH").
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.request(
                method,
                f"{REST_URL}{path}",
                headers=self._headers,
                json=json,
            )
            try:
                body = res.json() if res.content else None
            except ValueError:
                body = res.text
            return res.status_code, body


VIEWER_PROFILE_QUERY = """
query ViewerProfile($repoCount: Int = 30) {
  viewer {
    login
    name
    bio
    repositories(
      first: $repoCount
      ownerAffiliations: OWNER
      orderBy: { field: STARGAZERS, direction: DESC }
      isFork: false
    ) {
      totalCount
      nodes {
        nameWithOwner
        description
        stargazerCount
        forkCount
        primaryLanguage { name }
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
        repositoryTopics(first: 10) { nodes { topic { name } } }
        pushedAt
      }
    }
    pullRequests(first: 50, states: [MERGED, CLOSED, OPEN], orderBy: {field: CREATED_AT, direction: DESC}) {
      totalCount
      nodes {
        title
        merged
        repository { nameWithOwner stargazerCount }
        additions
        deletions
        changedFiles
        createdAt
      }
    }
  }
}
"""


async def fetch_viewer_profile(token: str, repo_count: int = 30) -> dict[str, Any]:
    client = GitHubClient(token)
    data = await client.graphql(VIEWER_PROFILE_QUERY, {"repoCount": repo_count})
    return data["data"]["viewer"]


VIEWER_PORTFOLIO_QUERY = """
query ViewerPortfolio($prCount: Int = 30) {
  viewer {
    login
    name
    bio
    location
    avatarUrl
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false) { totalCount }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            color
          }
        }
      }
    }
    pullRequests(
      first: $prCount
      states: MERGED
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      totalCount
      nodes {
        title
        url
        mergedAt
        additions
        deletions
        changedFiles
        repository {
          nameWithOwner
          stargazerCount
          primaryLanguage { name }
        }
      }
    }
  }
}
"""


VIEWER_PORTFOLIO_TTL = 60 * 30  # 30m — contributions calendar refreshes hourly upstream.


async def fetch_viewer_portfolio(token: str, pr_count: int = 30) -> dict[str, Any]:
    """Merged-PR list + contribution heatmap + headline stats for the dashboard."""
    client = GitHubClient(token)
    data = await client.graphql(
        VIEWER_PORTFOLIO_QUERY,
        {"prCount": pr_count},
        ttl=VIEWER_PORTFOLIO_TTL,
    )
    return data["data"]["viewer"]


REPO_ISSUES_QUERY = """
query RepoIssues($q: String!, $first: Int = 30) {
  search(query: $q, type: ISSUE, first: $first) {
    issueCount
    nodes {
      ... on Issue {
        id
        number
        title
        body
        url
        state
        createdAt
        updatedAt
        comments { totalCount }
        labels(first: 20) { nodes { name } }
        repository {
          id
          nameWithOwner
          stargazerCount
          forkCount
          description
          primaryLanguage { name }
          repositoryTopics(first: 10) { nodes { topic { name } } }
        }
      }
    }
  }
}
"""


ISSUE_FEED_TTL = 60 * 30  # 30m — issue state changes faster than profile data.


async def fetch_repo_beginner_issues(
    token: str,
    name_with_owner: str,
    limit: int = 30,
) -> dict[str, Any]:
    """Open issues tagged good-first-issue OR help-wanted for a single repo.

    Returns the `search` payload: {"issueCount": int, "nodes": [Issue, ...]}.
    Each Issue node is denormalized with its repository, so one response
    gives the ingestion pipeline everything it needs to upsert both tables.
    """
    client = GitHubClient(token)
    q = (
        f'repo:{name_with_owner} is:issue is:open '
        f'label:"good first issue","help wanted"'
    )
    data = await client.graphql(
        REPO_ISSUES_QUERY, {"q": q, "first": limit}, ttl=ISSUE_FEED_TTL
    )
    return data["data"]["search"]


RECENT_PRS_QUERY = """
query RecentMergedPRs($owner: String!, $name: String!, $first: Int = 10) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      first: $first
      states: MERGED
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      nodes {
        number
        title
        body
        url
        mergedAt
        additions
        deletions
        changedFiles
        author { login }
        commits(first: 5) {
          nodes {
            commit {
              messageHeadline
              messageBody
            }
          }
        }
      }
    }
  }
}
"""


RECENT_PRS_TTL = 60 * 60 * 6  # 6h — tone signal shifts slowly, but we want
# coaching output to reflect freshly merged house style within the same day.


async def fetch_recent_merged_prs(
    token: str,
    name_with_owner: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Most-recently-merged PRs on the default branch.

    Returns a list of PR nodes with title, body, top commits, and size stats.
    Caller is responsible for filtering bots and truncating bodies before
    handing the payload to an LLM.
    """
    owner, name = name_with_owner.split("/", 1)
    client = GitHubClient(token)
    data = await client.graphql(
        RECENT_PRS_QUERY,
        {"owner": owner, "name": name, "first": limit},
        ttl=RECENT_PRS_TTL,
    )
    repo = (data.get("data") or {}).get("repository") or {}
    return (repo.get("pullRequests") or {}).get("nodes") or []


REPO_CONTEXT_TTL = 60 * 60 * 24  # 24h — READMEs + tree shift slowly.

_README_CANDIDATES = [
    "HEAD:README.md",
    "HEAD:README.rst",
    "HEAD:README",
    "HEAD:readme.md",
    "HEAD:Readme.md",
    "HEAD:docs/README.md",
]

_README_QUERY_TEMPLATE = """
query RepoReadme($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { name }
%s
  }
}
"""


def _readme_query() -> str:
    fields = "\n".join(
        f'    f{i}: object(expression: "{expr}") {{ ... on Blob {{ text isBinary }} }}'
        for i, expr in enumerate(_README_CANDIDATES)
    )
    return _README_QUERY_TEMPLATE % fields


async def fetch_repo_readme(token: str, name_with_owner: str) -> str | None:
    """First non-binary README found under the default branch, or None."""
    owner, name = name_with_owner.split("/", 1)
    client = GitHubClient(token)
    data = await client.graphql(
        _readme_query(), {"owner": owner, "name": name}, ttl=REPO_CONTEXT_TTL
    )
    repo = (data.get("data") or {}).get("repository") or {}
    for i in range(len(_README_CANDIDATES)):
        blob = repo.get(f"f{i}")
        if blob and not blob.get("isBinary") and blob.get("text"):
            return blob["text"]
    return None


# Skip vendored/build dirs and binary-ish leaves when showing a tree to an LLM.
_TREE_SKIP_PARTS = {
    "node_modules",
    "dist",
    "build",
    "out",
    "target",
    ".git",
    ".next",
    ".venv",
    "venv",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".tox",
    "vendor",
    "third_party",
    "fixtures",
    "testdata",
    "coverage",
}
_TREE_KEEP_SUFFIXES = (
    ".py", ".pyi", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".go", ".rs", ".java", ".kt", ".scala", ".rb", ".php",
    ".c", ".h", ".cc", ".cpp", ".hpp", ".cs", ".swift", ".m",
    ".sh", ".bash", ".zsh",
    ".md", ".rst", ".txt",
    ".yaml", ".yml", ".toml", ".json", ".cfg", ".ini",
    ".sql", ".graphql", ".proto",
    "Dockerfile", "Makefile",
)


def _keep_path(path: str) -> bool:
    parts = path.split("/")
    if any(p in _TREE_SKIP_PARTS for p in parts):
        return False
    if path.endswith((".min.js", ".min.css", ".map", ".lock")):
        return False
    return path.endswith(_TREE_KEEP_SUFFIXES)


async def fetch_repo_tree(
    token: str, name_with_owner: str, max_paths: int = 250
) -> list[str]:
    """Shallow list of source-file paths on the default branch.

    Uses REST `git/trees/HEAD?recursive=1`. Filters out vendored/build dirs
    and keeps only recognized source/doc/config extensions. Caller decides
    how to present (sorted, grouped, truncated further) for the LLM.
    """
    client = GitHubClient(token)
    path = f"/repos/{name_with_owner}/git/trees/HEAD?recursive=1"
    data = await client.rest(path, ttl=REPO_CONTEXT_TTL)
    tree = data.get("tree") or []
    paths = [
        t["path"]
        for t in tree
        if t.get("type") == "blob" and _keep_path(t.get("path", ""))
    ]
    paths.sort()
    return paths[:max_paths]


# ---------------------------------------------------------------------------
# Fresh reads + writes for Fix Mode. None of these cache — Redis staleness on
# a base-SHA or a freshly-created fork causes silent, user-visible corruption.
# ---------------------------------------------------------------------------

MAX_EDITABLE_FILE_BYTES = 500 * 1024  # 500KB hard cap for in-browser editing.


def _raise_for_write(
    status: int,
    body: Any,
    method: str,
    path: str,
    *,
    allowed: tuple[int, ...] = (200, 201, 202, 204),
) -> None:
    if status in allowed:
        return
    detail = ""
    if isinstance(body, dict):
        detail = body.get("message") or str(body)
    else:
        detail = str(body or "")
    raise GitHubWriteError(status, body, f"GitHub {method} {path} -> {status}: {detail[:200]}")


async def fetch_default_branch_head(
    token: str, name_with_owner: str
) -> dict[str, str]:
    """Current default-branch name + HEAD commit sha. Uncached — freshness matters."""
    client = GitHubClient(token)
    status, body = await client.rest_raw("GET", f"/repos/{name_with_owner}")
    _raise_for_write(status, body, "GET", f"/repos/{name_with_owner}", allowed=(200,))
    default_branch = body.get("default_branch")
    if not default_branch:
        raise GitHubWriteError(200, body, f"Repo {name_with_owner} has no default branch")

    status, body = await client.rest_raw(
        "GET", f"/repos/{name_with_owner}/branches/{default_branch}"
    )
    _raise_for_write(
        status, body, "GET", f"/branches/{default_branch}", allowed=(200,)
    )
    sha = ((body or {}).get("commit") or {}).get("sha")
    if not sha:
        raise GitHubWriteError(200, body, "Default branch has no commit sha")
    return {"branch": default_branch, "sha": sha}


async def fetch_file_contents(
    token: str,
    name_with_owner: str,
    path: str,
    ref: str | None = None,
) -> dict[str, Any]:
    """Single-file read at a given ref.

    Returns {text, sha, size, encoding, truncated, is_binary}. `truncated=True`
    when size exceeds the editor cap — `text` is None in that case. `is_binary`
    is a best-effort heuristic (null bytes in first 4KB or non-UTF-8).
    """
    client = GitHubClient(token)
    url = f"/repos/{name_with_owner}/contents/{path}"
    if ref:
        url += f"?ref={ref}"
    status, body = await client.rest_raw("GET", url)
    if status == 404:
        raise GitHubWriteError(404, body, f"File not found: {path}")
    _raise_for_write(status, body, "GET", url, allowed=(200,))
    if isinstance(body, list):
        raise GitHubWriteError(200, body, f"Path is a directory, not a file: {path}")

    size = int(body.get("size") or 0)
    sha = body.get("sha") or ""
    if size > MAX_EDITABLE_FILE_BYTES:
        return {
            "text": None,
            "sha": sha,
            "size": size,
            "encoding": "base64",
            "truncated": True,
            "is_binary": False,
        }

    encoding = body.get("encoding") or "base64"
    raw = body.get("content") or ""
    if encoding == "base64":
        try:
            blob = base64.b64decode(raw)
        except Exception as exc:
            raise GitHubWriteError(200, body, f"Bad base64 for {path}: {exc}") from exc
    else:
        blob = raw.encode("utf-8", "replace")

    is_binary = b"\x00" in blob[:4096]
    text: str | None
    if is_binary:
        text = None
    else:
        try:
            text = blob.decode("utf-8")
        except UnicodeDecodeError:
            is_binary = True
            text = None

    return {
        "text": text,
        "sha": sha,
        "size": size,
        "encoding": "utf-8" if text is not None else "base64",
        "truncated": False,
        "is_binary": is_binary,
    }


async def fetch_repo_tree_full(
    token: str, name_with_owner: str, ref: str
) -> list[dict[str, Any]]:
    """Unfiltered blob+tree listing at a specific ref, for the file browser.

    Intentionally uncached because it's scoped to a session's captured
    base_sha and shouldn't drift across sessions. Returns entries with path,
    type, size, sha.
    """
    client = GitHubClient(token)
    status, body = await client.rest_raw(
        "GET", f"/repos/{name_with_owner}/git/trees/{ref}?recursive=1"
    )
    _raise_for_write(status, body, "GET", "git/trees", allowed=(200,))
    tree = (body or {}).get("tree") or []
    return [
        {
            "path": t.get("path", ""),
            "type": t.get("type", ""),
            "size": t.get("size") or 0,
            "sha": t.get("sha", ""),
        }
        for t in tree
        if t.get("type") in ("blob", "tree")
    ]


async def ensure_fork(
    token: str, upstream: str, viewer_login: str
) -> dict[str, Any]:
    """Idempotently ensure the viewer has a fork of `upstream`.

    Steps:
      1. GET /repos/{viewer}/{name}. If it's a fork of `upstream`, done.
         If it exists but points elsewhere, raise ForkNameCollision.
      2. Otherwise POST /repos/{upstream}/forks (202 accepted).
      3. Poll /repos/{viewer}/{name} up to ~30s until default branch is live.

    Returns {full_name, ready, default_branch}. `ready=False` on timeout —
    the caller should 503 and let the user retry.
    """
    client = GitHubClient(token)
    _, upstream_name = upstream.split("/", 1)
    fork_full = f"{viewer_login}/{upstream_name}"

    status, body = await client.rest_raw("GET", f"/repos/{fork_full}")
    if status == 200:
        parent = (body.get("parent") or {}).get("full_name")
        if parent and parent.lower() == upstream.lower():
            return {
                "full_name": fork_full,
                "ready": True,
                "default_branch": body.get("default_branch") or "main",
            }
        raise ForkNameCollision(
            409,
            body,
            f"You already have a repo named {fork_full} that is not a fork of {upstream}. "
            "Rename it on GitHub and retry.",
        )
    if status != 404:
        _raise_for_write(status, body, "GET", f"/repos/{fork_full}", allowed=(200, 404))

    status, body = await client.rest_raw("POST", f"/repos/{upstream}/forks")
    _raise_for_write(status, body, "POST", "/forks", allowed=(202,))

    # Fork creation is async; poll until the repo is usable.
    for _ in range(15):
        await asyncio.sleep(2.0)
        s, b = await client.rest_raw("GET", f"/repos/{fork_full}")
        if s == 200 and b.get("default_branch"):
            return {
                "full_name": fork_full,
                "ready": True,
                "default_branch": b.get("default_branch"),
            }
    return {"full_name": fork_full, "ready": False, "default_branch": None}


async def create_blob(
    token: str, fork_full_name: str, content: str, encoding: str = "utf-8"
) -> str:
    client = GitHubClient(token)
    payload = {"content": content, "encoding": encoding}
    status, body = await client.rest_raw(
        "POST", f"/repos/{fork_full_name}/git/blobs", json=payload
    )
    _raise_for_write(status, body, "POST", "git/blobs", allowed=(201,))
    log_github_write(op="create_blob", target=fork_full_name, status=status)
    return body["sha"]


async def create_tree(
    token: str,
    fork_full_name: str,
    base_tree_sha: str,
    entries: list[dict[str, str]],
) -> str:
    """entries: [{path, mode (e.g. "100644"), type ("blob"), sha}]."""
    client = GitHubClient(token)
    payload = {"base_tree": base_tree_sha, "tree": entries}
    status, body = await client.rest_raw(
        "POST", f"/repos/{fork_full_name}/git/trees", json=payload
    )
    _raise_for_write(status, body, "POST", "git/trees", allowed=(201,))
    log_github_write(op="create_tree", target=fork_full_name, status=status)
    return body["sha"]


async def create_commit(
    token: str,
    fork_full_name: str,
    message: str,
    tree_sha: str,
    parent_sha: str,
) -> str:
    client = GitHubClient(token)
    payload = {"message": message, "tree": tree_sha, "parents": [parent_sha]}
    status, body = await client.rest_raw(
        "POST", f"/repos/{fork_full_name}/git/commits", json=payload
    )
    _raise_for_write(status, body, "POST", "git/commits", allowed=(201,))
    log_github_write(op="create_commit", target=fork_full_name, status=status)
    return body["sha"]


async def create_or_update_ref(
    token: str,
    fork_full_name: str,
    branch: str,
    sha: str,
    force: bool = False,
) -> None:
    """Create `refs/heads/{branch}` pointing at `sha`; PATCH if it already exists."""
    client = GitHubClient(token)
    status, body = await client.rest_raw(
        "POST",
        f"/repos/{fork_full_name}/git/refs",
        json={"ref": f"refs/heads/{branch}", "sha": sha},
    )
    if status == 201:
        log_github_write(op="create_ref", target=fork_full_name, status=status)
        return
    if status == 422:
        status, body = await client.rest_raw(
            "PATCH",
            f"/repos/{fork_full_name}/git/refs/heads/{branch}",
            json={"sha": sha, "force": force},
        )
        _raise_for_write(status, body, "PATCH", f"refs/heads/{branch}", allowed=(200,))
        log_github_write(op="update_ref", target=fork_full_name, status=status)
        return
    _raise_for_write(status, body, "POST", "git/refs", allowed=(201,))


async def create_pull_request(
    token: str,
    upstream: str,
    head: str,
    base: str,
    title: str,
    body: str,
    draft: bool = False,
) -> dict[str, Any]:
    """POST /repos/{upstream}/pulls. `head` must be "{user_login}:{branch}"."""
    client = GitHubClient(token)
    payload = {"title": title, "head": head, "base": base, "body": body, "draft": draft}
    status, resp = await client.rest_raw(
        "POST", f"/repos/{upstream}/pulls", json=payload
    )
    _raise_for_write(status, resp, "POST", "/pulls", allowed=(201,))
    log_github_write(op="create_pr", target=upstream, status=status)
    return {"url": resp.get("html_url"), "number": resp.get("number")}
