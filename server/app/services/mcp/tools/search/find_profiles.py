# find_profiles.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish profile search (first, last, alias).

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


def _score_profile(
    q_norm: str,
    toks: List[str],
    first: str | None,
    last: str | None,
    alias: str | None,
) -> int:
    """Heuristic ranking. Bigger is better."""
    first_n = _norm(first or "")
    last_n = _norm(last or "")
    alias_n = _norm(alias or "")

    full_n = (first_n + " " + last_n).strip()

    score = 0

    # Exact full-name match
    if full_n and full_n == q_norm:
        score += 100

    # Exact single-field matches
    if first_n and first_n == q_norm:
        score += 90
    if last_n and last_n == q_norm:
        score += 90
    if alias_n and alias_n == q_norm:
        score += 90

    # Prefix bumps (full query)
    if first_n.startswith(q_norm):
        score += 60
    if last_n.startswith(q_norm):
        score += 60
    if alias_n.startswith(q_norm):
        score += 40

    # Per-token prefix + contains bumps
    for t in toks:
        if first_n.startswith(t):
            score += 30
        if last_n.startswith(t):
            score += 30
        if alias_n.startswith(t):
            score += 20

        if t in first_n:
            score += 10
        if t in last_n:
            score += 10
        if t in alias_n:
            score += 5

    # Whole-query contains bump
    if q_norm in first_n or q_norm in last_n or q_norm in alias_n:
        score += 5

    return score


async def find_profiles(conn: asyncpg.Connection, query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Find profiles by name using fuzzy first/last/alias search."""
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

        # Exact match conditions
        where_conditions.append(f"LOWER(p.first_name) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        where_conditions.append(f"LOWER(p.last_name) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        where_conditions.append(f"LOWER(p.alias) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        # Prefix match conditions
        where_conditions.append(f"LOWER(p.first_name) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        where_conditions.append(f"LOWER(p.last_name) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        where_conditions.append(f"LOWER(p.alias) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        # Full string contains conditions
        where_conditions.append(f"LOWER(p.first_name) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        where_conditions.append(f"LOWER(p.last_name) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        where_conditions.append(f"LOWER(p.alias) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        # Token-based conditions
        for pattern in token_patterns:
            where_conditions.append(
                f"(LOWER(p.first_name) LIKE ${param_idx} OR LOWER(p.last_name) LIKE ${param_idx} OR LOWER(p.alias) LIKE ${param_idx})"
            )
            params.append(pattern)
            param_idx += 1

        where_clause = " OR ".join(where_conditions)

        # Query profiles with fuzzy matching
        sql = f"""
            SELECT 
                p.id,
                p.first_name,
                p.last_name,
                p.alias,
                p.role
            FROM profiles p
            WHERE {where_clause}
            LIMIT ${param_idx}
        """
        params.append(limit * 5)  # type: ignore  # Candidate pool

        profiles = await conn.fetch(sql, *params)

        # Score and build results
        results: List[Dict[str, Any]] = []
        for profile in profiles:
            first = profile["first_name"]
            last = profile["last_name"]
            alias = profile["alias"]
            full_name = " ".join(x for x in (first, last) if x) or alias or "Unknown"

            score = _score_profile(q_norm, toks, first, last, alias)

            results.append(
                {
                    "id": str(profile["id"]),
                    "first_name": first,
                    "last_name": last,
                    "alias": alias,
                    "role": profile["role"],
                    "full_name": full_name,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["full_name"]))
        return results[:limit]

    except Exception as e:
        return [{"error": f"Database error: {str(e)}"}]
