# find_cohorts.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish cohort search (title + description).
#
# Usage:
#   await find_cohorts(conn, "Fall 2025 freshmen")
#
# Returns:
#   [
#     {
#       "id": "...",
#       "title": "...",
#       "active": True,
#       "description": "...",
#       "profile_count": 42,
#       "score": 137,
#     },
#     ...
#   ]
#

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List

import asyncpg  # type: ignore

# ---------------------------
# Normalization helpers
# ---------------------------

_WS_RE = re.compile(r"\s+")


def _norm(s: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return _WS_RE.sub(" ", s.strip().lower())


def _tokens(s: str) -> List[str]:
    return [t for t in _norm(s).split(" ") if t]


# ---------------------------
# Scoring heuristic
# ---------------------------


def _score_cohort(
    q_norm: str, toks: List[str], title: str | None, desc: str | None
) -> int:
    """
    Rank candidates. Title is much stronger than description.
    """
    t_norm = _norm(title or "")
    d_norm = _norm(desc or "")

    score = 0

    # Exact whole-title match
    if t_norm == q_norm:
        score += 100

    # Exact description match (rare, low weight)
    if d_norm and d_norm == q_norm:
        score += 40

    # Prefix on full query
    if t_norm.startswith(q_norm):
        score += 60
    if d_norm.startswith(q_norm):
        score += 20

    # Token boosts
    for tok in toks:
        if t_norm.startswith(tok):
            score += 25
        if tok in t_norm:
            score += 10

        if d_norm.startswith(tok):
            score += 8
        if tok in d_norm:
            score += 4

    # Whole query appears somewhere
    if q_norm in t_norm or q_norm in d_norm:
        score += 5

    # Length proximity bonus (favor tight title matches)
    gap = abs(len(t_norm) - len(q_norm))
    score += max(0, 10 - gap)

    return score


# ---------------------------
# Public search function
# ---------------------------


async def find_cohorts(conn: asyncpg.Connection, query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Find cohorts by title/description using fuzzy search."""
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
        where_conditions.append(f"LOWER(c.title) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        where_conditions.append(f"LOWER(c.description) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        # Prefix match conditions
        where_conditions.append(f"LOWER(c.title) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        where_conditions.append(f"LOWER(c.description) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        # Full string contains conditions
        where_conditions.append(f"LOWER(c.title) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        where_conditions.append(f"LOWER(c.description) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        # Token-based conditions
        for pattern in token_patterns:
            where_conditions.append(
                f"(LOWER(c.title) LIKE ${param_idx} OR LOWER(c.description) LIKE ${param_idx})"
            )
            params.append(pattern)
            param_idx += 1

        where_clause = " OR ".join(where_conditions)

        # Query cohorts with fuzzy matching
        sql = f"""
            SELECT 
                c.id,
                c.title,
                c.active,
                c.description
            FROM cohorts c
            WHERE {where_clause}
            LIMIT ${param_idx}
        """
        params.append(limit * 5)  # Candidate pool

        cohorts = await conn.fetch(sql, *params)

        if not cohorts:
            return []

        # Get profile counts from junction table
        cohort_ids = [str(c["id"]) for c in cohorts]
        
        if cohort_ids:
            count_sql = """
                SELECT cohort_id, COUNT(*) as profile_count
                FROM cohort_profiles
                WHERE cohort_id = ANY($1::uuid[])
                    AND active = true
                GROUP BY cohort_id
            """
            count_results = await conn.fetch(count_sql, cohort_ids)
            cohort_profile_counts = {
                str(row["cohort_id"]): row["profile_count"] 
                for row in count_results
            }
        else:
            cohort_profile_counts = {}

        # Score and build results
        results: List[Dict[str, Any]] = []
        for c in cohorts:
            score = _score_cohort(q_norm, toks, c["title"], c["description"])
            results.append(
                {
                    "id": str(c["id"]),
                    "title": c["title"],
                    "active": c["active"],
                    "description": c["description"],
                    "profile_count": cohort_profile_counts.get(str(c["id"]), 0),
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["title"] or ""))
        return results[:limit]

    except Exception as e:
        return [{"error": f"Database error: {str(e)}"}]
