# find_scenarios.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish scenario search (name + problem_statement).
#
# Usage:
#   find_scenarios("medication error")
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

from app.db import get_session
from app.models import Scenarios
from sqlalchemy import func, literal, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select

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


def find_scenarios(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find scenarios by name/problem_statement
    --------------------------------------------
    Fuzzy, case-insensitive search on scenario name and problem statement.

    Input
        • query - Scenario name or problem statement to search for
        • limit - Max results (default: 10)

    Returns
        [
            {
                "id": str,                       # Scenario UUID
                "name": str | None,              # Scenario name/title
                "problem_statement": str | None, # Scenario problem statement
                "persona_id": str | None,        # Linked persona UUID (if any)
                "default_scenario": bool,        # Is this the default scenario?
                "score": int                     # Heuristic match score
            },
            ...
        ]

    Quick-start
        ask:  "Find scenarios for medication errors"
        call: find_scenarios("medication error")

    See also 👉 scenario_overview() for detailed scenario data.
    """
    q_norm = _norm(query)
    if not q_norm:
        return []
    toks = _tokens(query)

    session = next(get_session())
    try:
        s_name = func.lower(Scenarios.name)
        s_problem = func.lower(Scenarios.problem_statement)

        like_full = f"%{q_norm}%"
        like_prefix = f"{q_norm}%"

        token_ors = []
        for t in toks:
            p = f"%{t}%"
            token_ors.append(or_(s_name.like(p), s_problem.like(p)))

        pred = or_(
            s_name == q_norm,
            s_problem == q_norm,
            s_name.like(like_prefix),
            s_problem.like(like_prefix),
            s_name.like(like_full),
            s_problem.like(like_full),
            or_(*token_ors) if token_ors else literal(False),
        )

        stmt = (
            select(Scenarios).where(pred).limit(limit * 5)  # candidate pool
        )

        scenarios = session.exec(stmt).all()

        # Get persona associations from junction table
        from app.models import ScenarioPersonas
        scenario_ids = [sc.id for sc in scenarios]
        persona_links = session.exec(
            select(ScenarioPersonas).where(
                ScenarioPersonas.scenario_id.in_(scenario_ids),
                ScenarioPersonas.active == True
            )
        ).all()
        
        # Map scenario_id -> persona_id
        scenario_persona_map = {link.scenario_id: link.persona_id for link in persona_links}

        results: List[Dict[str, Any]] = []
        for sc in scenarios:
            score = _score_scenario(q_norm, toks, sc.name, sc.problem_statement)
            persona_id = scenario_persona_map.get(sc.id)
            results.append(
                {
                    "id": str(sc.id),
                    "name": sc.name,
                    "problem_statement": sc.problem_statement,
                    "persona_id": str(persona_id) if persona_id else None,
                    "default_scenario": sc.default_scenario,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["name"] or ""))
        return results[:limit]

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()
