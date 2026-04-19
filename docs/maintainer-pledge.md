# Maintainer Pledge

OpenSourceHire is built to *help* OSS maintainers, not flood them with AI slop.

## Our commitments

1. **Human in the loop.** Every PR drafted with `osh` requires manual edit + explicit submit. The tool will never push or open a PR autonomously.
2. **Transparent disclosure.** PR bodies drafted with assistance include a short, honest disclosure block.
3. **Respect anti-AI repos.** Repositories with anti-AI contribution policies are filtered out of the `osh` feed at ingestion time. We maintain a public deny-list and accept maintainer requests to be added.
4. **Quality gate before submit.** The CLI runs lint/tests where possible and surfaces failures before drafting a PR.
5. **Maintainer reachout.** Maintainers can email opt-out@opensourcehire.dev to be removed from the feed.

## Disclosure block (auto-appended)

```
---
This PR was drafted with help from OpenSourceHire (osh) — the contributor
reviewed and edited every change. Reply with "osh-feedback" if anything
looks off; it helps us tune the tool.
```
