# find_personas.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish agent search (name).
#
# Usage:
#   find_agents("aggressive")
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

from app.db import get_session
from app.models import Personas
from sqlalchemy import func, literal, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select

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


def find_personas(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find personas by name
    ------------------------
    Performs a case-insensitive, fuzzy search on persona names.

    Input
        • query - Name of the persona to search for
        • limit - Max results (default: 10)

    Returns
        [ { "id": "...", "name": "...", "description": "...", "score": ... }, ... ]
        or [ { "error": "Database error: ..." } ] on failure

    Quick-start
        ask:  "Find the aggressive persona"
        call: find_personas("Aggressive")

    See also 👉 persona_overview() for detailed persona data.
    """
    q_norm = _norm(query)
    if not q_norm:
        return []
    toks = _tokens(query)

    session = next(get_session())
    try:
        a_name = func.lower(Personas.name)

        like_full = f"%{q_norm}%"
        like_prefix = f"{q_norm}%"

        # token OR clauses
        token_ors = []
        for t in toks:
            p = f"%{t}%"
            token_ors.append(a_name.like(p))

        pred = or_(
            a_name == q_norm,  # exact
            a_name.like(like_prefix),  # prefix
            a_name.like(like_full),  # contains
            or_(*token_ors) if token_ors else literal(False),
        )

        stmt = (
            select(Personas).where(pred).limit(limit * 5)  # candidate pool
        )

        personas = session.exec(stmt).all()

        results: List[Dict[str, Any]] = []
        for a in personas:
            score = _score_persona(q_norm, toks, a.name)
            results.append(
                {
                    "id": str(a.id),
                    "name": a.name,
                    "description": a.description,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["name"] or ""))
        return results[:limit]

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()
