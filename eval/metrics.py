"""Metric implementations for the eval harness.

Pure functions, no I/O. Keeps `run_study.py` thin and makes each metric
unit-testable in isolation.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Iterable, Sequence


def precision_at_k(predicted: Sequence[str], relevant: Iterable[str], k: int) -> float:
    """Fraction of the top-k predicted items that appear in the relevant set."""
    if k <= 0:
        return 0.0
    rel = set(relevant)
    if not rel:
        return 0.0
    top = predicted[:k]
    if not top:
        return 0.0
    hits = sum(1 for item in top if item in rel)
    return hits / k


def recall_at_k(predicted: Sequence[str], relevant: Iterable[str], k: int) -> float:
    rel = set(relevant)
    if not rel:
        return 0.0
    top = set(predicted[:k])
    return len(top & rel) / len(rel)


def merge_rate(drafts: Iterable[dict]) -> float:
    """Fraction of drafted PRs that ended up merged.

    Each draft dict is expected to have a boolean `merged` field. Drafts
    where the field is missing are treated as not merged.
    """
    drafts = list(drafts)
    if not drafts:
        return 0.0
    return sum(1 for d in drafts if d.get("merged")) / len(drafts)


_TOKEN_RE = re.compile(r"\w+")


def _tokens(s: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(s or "")]


def _ngrams(tokens: Sequence[str], n: int) -> Counter:
    if len(tokens) < n:
        return Counter()
    return Counter(tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1))


def bleu(candidate: str, reference: str, max_n: int = 4) -> float:
    """Corpus-style BLEU on a single (candidate, reference) pair.

    Smoothed (add-1) so a single short pair doesn't collapse to 0 the
    moment any n-gram order misses. Good enough for relative comparisons
    of PR-message style; not a substitute for SacreBLEU at scale.
    """
    cand = _tokens(candidate)
    ref = _tokens(reference)
    if not cand or not ref:
        return 0.0

    log_precisions: list[float] = []
    for n in range(1, max_n + 1):
        cand_ngrams = _ngrams(cand, n)
        ref_ngrams = _ngrams(ref, n)
        if not cand_ngrams:
            log_precisions.append(math.log(1e-9))
            continue
        overlap = sum(min(c, ref_ngrams[g]) for g, c in cand_ngrams.items())
        total = sum(cand_ngrams.values())
        # Add-1 smoothing.
        p = (overlap + 1) / (total + 1)
        log_precisions.append(math.log(p))

    geo_mean = math.exp(sum(log_precisions) / max_n)
    bp = 1.0 if len(cand) >= len(ref) else math.exp(1 - len(ref) / max(len(cand), 1))
    return bp * geo_mean


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def mean(values: Iterable[float]) -> float:
    vals = list(values)
    if not vals:
        return 0.0
    return sum(vals) / len(vals)
