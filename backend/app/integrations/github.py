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
