from pathlib import Path

from app.services import policy
from app.services.policy import (
    AI_DRAFT_DISCLOSURE,
    append_ai_disclosure,
    detect_anti_ai,
)


def test_disclosure_appended_when_absent() -> None:
    body = "Fixes #42.\n\nAdds a retry loop for flaky tests."
    out = append_ai_disclosure(body)
    assert out.endswith(AI_DRAFT_DISCLOSURE)
    assert body in out


def test_disclosure_idempotent() -> None:
    body = "Fixes #42."
    once = append_ai_disclosure(body)
    twice = append_ai_disclosure(once)
    assert once == twice


def test_disclosure_handles_empty_body() -> None:
    assert append_ai_disclosure("") == AI_DRAFT_DISCLOSURE


def test_detect_anti_ai_via_readme_keyword() -> None:
    readme = "## Contributing\n\nPlease note: **No AI-generated PRs** will be accepted."
    assert detect_anti_ai("some/repo", readme) is True


def test_detect_anti_ai_ignores_benign_ai_mentions() -> None:
    readme = "This library makes it easy to call LLMs like Claude and GPT."
    assert detect_anti_ai("some/repo", readme) is False


def test_detect_anti_ai_context_required_pattern() -> None:
    # "will be closed without review" alone shouldn't trigger
    benign = "Stale issues will be closed without review after 90 days."
    assert detect_anti_ai("some/repo", benign) is False

    # But paired with AI context, it should
    malign = "AI-assisted PRs will be closed without review. No exceptions."
    assert detect_anti_ai("some/repo", malign) is True


def test_blocklist_loaded_from_file(tmp_path: Path, monkeypatch) -> None:
    block_file = tmp_path / "anti_ai_repos.txt"
    block_file.write_text("# comment\nFoo/Bar\nbaz/qux\n")

    monkeypatch.setattr(policy, "BLOCKLIST_PATH", block_file)
    policy.reload_blocklist()

    assert detect_anti_ai("foo/bar", readme=None) is True
    assert detect_anti_ai("FOO/BAR", readme=None) is True
    assert detect_anti_ai("baz/qux", readme=None) is True
    assert detect_anti_ai("allowed/repo", readme=None) is False

    policy.reload_blocklist()
