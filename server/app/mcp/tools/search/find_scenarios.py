# find_scenarios.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish scenario search (name + problem_statement).
#
# Usage:
#   await find_scenarios(conn, "medication error")
#
# Returns:
#   [
#     {
#       "id": "...",
#       "name": "...",
#       "description": "...",
#       "persona_id": "...",
#       "default_scenario": False,
#       "practice_scenario": True,
#       "score": 133,
#     },
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
# (You may want to DRY these into a shared util module.)
# ------------------------------------------------------------------

_WS_RE = re.compile(r"\s+")


def _norm(s: str) -> str:
    """Lowercase, remove accents, collapse internal whitespace."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return _WS_RE.sub(" ", s.strip().lower())


def _tokens(s: str) -> List[str]:
    return [t for t in _norm(s).split(" ") if t]


# ------------------------------------------------------------------
# Scoring heuristic
# ------------------------------------------------------------------


def _score_scenario(
    q_norm: str, toks: List[str], name: str | None, desc: str | None
) -> int:
    """
    Score a scenario candidate.
    Name carries more weight than problem_statement.
    """
    n_norm = _norm(name or "")
    d_norm = _norm(desc or "")

    score = 0

    # Whole-string exact
    if n_norm == q_norm:
        score += 100
    if d_norm == q_norm:
        score += 40

    # Prefix boosts
    if n_norm.startswith(q_norm):
        score += 60
    if d_norm.startswith(q_norm):
        score += 20

    # Token boosts
    for tok in toks:
        if n_norm.startswith(tok):
            score += 25
        if tok in n_norm:
            score += 10

        if d_norm.startswith(tok):
            score += 8
        if tok in d_norm:
            score += 4

    # Whole query appears anywhere
    if q_norm in n_norm or q_norm in d_norm:
        score += 5

    # Tight-length bonus (helps shorter titles bubble up)
    gap = abs(len(n_norm) - len(q_norm))
    score += max(0, 10 - gap)

    return score


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------


async def find_scenarios(conn: asyncpg.Connection, query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Find scenarios by name/problem_statement using fuzzy search."""
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

        # Exact match conditions
        where_conditions.append(f"LOWER(s.name) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        where_conditions.append(f"LOWER(s.problem_statement) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

        # Prefix match conditions
        where_conditions.append(f"LOWER(s.name) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        where_conditions.append(f"LOWER(s.problem_statement) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

        # Full string contains conditions
        where_conditions.append(f"LOWER(s.name) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        where_conditions.append(f"LOWER(s.problem_statement) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

        # Token-based conditions
        for pattern in token_patterns:
            where_conditions.append(
                f"(LOWER(s.name) LIKE ${param_idx} OR LOWER(s.problem_statement) LIKE ${param_idx})"
            )
            params.append(pattern)
            param_idx += 1

        where_clause = " OR ".join(where_conditions)

        # Query scenarios with fuzzy matching
        sql = f"""
            SELECT 
                s.id,
                s.name,
                s.problem_statement,
                s.default_scenario
            FROM scenarios s
            WHERE {where_clause}
            LIMIT ${param_idx}
        """
        params.append(limit * 5)  # Candidate pool

        scenarios = await conn.fetch(sql, *params)

        if not scenarios:
            return []

        # Get persona associations from junction table
        scenario_ids = [str(sc["id"]) for sc in scenarios]
        
        if scenario_ids:
            persona_sql = """
                SELECT scenario_id, persona_id
                FROM scenario_personas
                WHERE scenario_id = ANY($1::uuid[])
                    AND active = true
            """
            persona_links = await conn.fetch(persona_sql, scenario_ids)
            scenario_persona_map = {
                str(link["scenario_id"]): str(link["persona_id"]) 
                for link in persona_links
            }
        else:
            scenario_persona_map = {}

        # Score and build results
        results: List[Dict[str, Any]] = []
        for sc in scenarios:
            score = _score_scenario(
                q_norm, toks, sc["name"], sc["problem_statement"]
            )
            persona_id = scenario_persona_map.get(str(sc["id"]))
            results.append(
                {
                    "id": str(sc["id"]),
                    "name": sc["name"],
                    "problem_statement": sc["problem_statement"],
                    "persona_id": persona_id if persona_id else None,
                    "default_scenario": sc["default_scenario"],
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["name"] or ""))
        return results[:limit]

    except Exception as e:
        return [{"error": f"Database error: {str(e)}"}]
