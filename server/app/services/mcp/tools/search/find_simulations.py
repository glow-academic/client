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

from app.db import get_session
from app.models import Simulations
from sqlalchemy import func, literal, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select

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


def find_simulations(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find simulations by title
    ----------------------------
    Fuzzy sim title search.

    Input
      • query - Simulation title to search for
      • limit - Max results (default: 10)

    Returns
      [
        {
          "id": str,                # Simulation UUID
          "title": str | None,      # Simulation title
          "active": bool,           # Is the simulation active?
          "time_limit": int | None, # Time limit in minutes (if any)
          "created_at": str | None, # ISO8601 creation timestamp
          "score": int              # Heuristic match score
        },
        ...
      ]

    Quick-start
      ask:  "Which sims mention 'cardiac'?"
      call: find_simulations("cardiac")

    See also 👉 simulation_overview() for detailed sim data.
    """
    q_norm = _norm(query)
    toks = _tokens(query)

    if not q_norm:
        return []

    session = next(get_session())
    try:
        s_title = func.lower(Simulations.title)
        like_full = f"%{q_norm}%"
        like_prefix = f"{q_norm}%"

        # token ORs across title
        token_ors = []
        for t in toks:
            p = f"%{t}%"
            token_ors.append(s_title.like(p))

        broad_pred = or_(
            s_title == q_norm,            # exact
            s_title.like(like_prefix),    # prefix
            s_title.like(like_full),      # contains whole query
            or_(*token_ors) if token_ors else literal(False),  # token contains
        )

        stmt = (
            select(Simulations)
            .where(broad_pred)
            .limit(limit * 5)  # fetch candidate pool; rank in Python
        )

        sims = session.exec(stmt).all()

        results: List[Dict[str, Any]] = []
        for sim in sims:
            score = _score_simulation(q_norm, toks, sim.title)
            results.append(
                {
                    "id": str(sim.id),
                    "title": sim.title,
                    "active": sim.active,
                    "time_limit": sim.time_limit,
                    "created_at": sim.created_at.isoformat() if sim.created_at else None,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["title"]))
        return results[:limit]

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()