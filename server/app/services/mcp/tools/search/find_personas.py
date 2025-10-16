# find_personas.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish persona search (name).
#
# Usage:
#   await find_personas("aggressive")
#
# Returns:
#   [
#     {"id": "...", "name": "...", "description": "...", "score": 127},
#     ...
#   ]
#

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List

import asyncpg  # type: ignore

# ------------------------------------------------------------------
# Normalization / tokenization utilities
# (Consider moving to a shared search util module.)
# ------------------------------------------------------------------

_WS_RE = re.compile(r"\s+")


def _norm(s: str) -> str:
    """Lowercase, strip accents, collapse internal whitespace."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return _WS_RE.sub(" ", s.strip().lower())


def _tokens(s: str) -> List[str]:
    return [t for t in _norm(s).split(" ") if t]


# ------------------------------------------------------------------
# Scoring heuristic
# ------------------------------------------------------------------


def _score_persona(q_norm: str, toks: List[str], name: str | None) -> int:
    """
    Score a persona candidate relative to the normalized query + tokens.
    """
    n_norm = _norm(name or "")
    score = 0

    # Whole-string exact
    if n_norm == q_norm:
        score += 100

    # Whole-string prefix
    if n_norm.startswith(q_norm):
        score += 60

    # Per-token boosts
    for tok in toks:
        if n_norm.startswith(tok):
            score += 25
        if tok in n_norm:
            score += 10

    # Whole query appears anywhere
    if q_norm in n_norm:
        score += 5

    # Length proximity bonus (prefer shorter closer names)
    gap = abs(len(n_norm) - len(q_norm))
    score += max(0, 10 - gap)

    return score


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------


async def find_personas(conn: asyncpg.Connection, query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Find personas by name using fuzzy search."""
    q_norm = _norm(query)
    if not q_norm:
        return []
    toks = _tokens(query)

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
        where_conditions.append(f"LOWER(p.name) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        # Prefix match condition
        where_conditions.append(f"LOWER(p.name) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        # Full string contains condition
        where_conditions.append(f"LOWER(p.name) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        # Token-based conditions
        for pattern in token_patterns:
            where_conditions.append(f"LOWER(p.name) LIKE ${param_idx}")
            params.append(pattern)
            param_idx += 1

        where_clause = " OR ".join(where_conditions)

        # Query personas with fuzzy matching
        sql = f"""
            SELECT 
                p.id,
                p.name,
                p.description
            FROM personas p
            WHERE {where_clause}
            LIMIT ${param_idx}
        """
        params.append(limit * 5)  # type: ignore  # Candidate pool

        personas = await conn.fetch(sql, *params)

        # Score and build results
        results: List[Dict[str, Any]] = []
        for a in personas:
            score = _score_persona(q_norm, toks, a["name"])
            results.append(
                {
                    "id": str(a["id"]),
                    "name": a["name"],
                    "description": a["description"],
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["name"] or ""))
        return results[:limit]

    except Exception as e:
        return [{"error": f"Database error: {str(e)}"}]
