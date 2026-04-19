"""GitHub GraphQL + REST client.

Single source of truth for all GitHub access. Caches reads in Redis to stay
well under the 5000 req/hr GraphQL rate limit.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.services.cache import cache_key, get_json, set_json

GRAPHQL_URL = "https://api.github.com/graphql"
REST_URL = "https://api.github.com"

DEFAULT_TTL = 60 * 60  # 1h


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
