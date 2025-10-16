# find_simulations.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish simulation title search.

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List

import asyncpg  # type: ignore

_WS_RE = re.compile(r"\s+")


def _norm(s: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return _WS_RE.sub(" ", s.strip().lower())


def _tokens(s: str) -> List[str]:
    return [t for t in _norm(s).split(" ") if t]


def _score_simulation(q_norm: str, toks: List[str], title: str | None) -> int:
    """Heuristic ranking; higher = better."""
    t_norm = _norm(title or "")
    score = 0

    # Exact whole-title match
    if t_norm == q_norm:
        score += 100

    # Prefix (whole query)
    if t_norm.startswith(q_norm):
        score += 70

    # Per-token boosts
    for tok in toks:
        if t_norm.startswith(tok):
            score += 20
        if tok in t_norm:
            score += 10

    # Whole query appears somewhere
    if q_norm in t_norm:
        score += 5

    # Length proximity bonus (favor shorter / tighter match)
    gap = abs(len(t_norm) - len(q_norm))
    score += max(0, 10 - gap)

    return score


async def find_simulations(conn: asyncpg.Connection, query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Find simulations by title using fuzzy search."""
    q_norm = _norm(query)
    toks = _tokens(query)

    if not q_norm:
        return []

    try:
        # Build WHERE clause dynamically for fuzzy matching
        like_full = f"%{q_norm}%"
        like_prefix = f"{q_norm}%"

        # Build token patterns for each token
        token_patterns = [f"%{t}%" for t in toks]

        # Build dynamic SQL with OR conditions
        where_conditions = []
        params: List[Any] = []
        param_idx = 1

        # Exact match condition
        where_conditions.append(f"LOWER(s.title) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        # Prefix match condition
        where_conditions.append(f"LOWER(s.title) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        # Full string contains condition
        where_conditions.append(f"LOWER(s.title) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        # Token-based conditions
        for pattern in token_patterns:
            where_conditions.append(f"LOWER(s.title) LIKE ${param_idx}")
            params.append(pattern)
            param_idx += 1

        where_clause = " OR ".join(where_conditions)

        # Query simulations with fuzzy matching
        sql = f"""
            SELECT 
                s.id,
                s.title,
                s.active,
                s.time_limit,
                s.created_at
            FROM simulations s
            WHERE {where_clause}
            LIMIT ${param_idx}
        """
        params.append(limit * 5)  # type: ignore  # Candidate pool

        sims = await conn.fetch(sql, *params)

        # Score and build results
        results: List[Dict[str, Any]] = []
        for sim in sims:
            score = _score_simulation(q_norm, toks, sim["title"])
            results.append(
                {
                    "id": str(sim["id"]),
                    "title": sim["title"],
                    "active": sim["active"],
                    "time_limit": sim["time_limit"],
                    "created_at": sim["created_at"].isoformat()
                    if sim["created_at"]
                    else None,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["title"]))
        return results[:limit]

    except Exception as e:
        return [{"error": f"Database error: {str(e)}"}]
