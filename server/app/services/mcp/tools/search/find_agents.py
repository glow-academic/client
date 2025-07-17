# find_agents.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish agent search (name).

from typing import Any, Dict, List

from app.db import get_session
from app.models import Agents
from sqlalchemy import func, literal, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def find_agents(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find agents by name
    ------------------------
    Performs a case-insensitive, fuzzy search on agent names.

    Input
      • query - Name of the agent to search for
      • limit - Max results (default: 10)

    Returns
      [ { "id": "...", "name": "...", "description": "..." }, ... ]

    Quick-start
      ask:  "Find the aggressive agent"
      call: find_agents("Aggressive")

    See also 👉 agent_overview() for detailed agent data.
    """
    session = next(get_session())
    try:
        q_norm = query.strip().lower()
        toks = [t for t in q_norm.split() if t]

        # full-string contains
        like_full = f"%{q_norm}%"

        # token contains OR across tokens
        token_ors = []
        for t in toks:
            p = f"%{t}%"
            token_ors.append(func.lower(Agents.name).like(p))

        stmt = (
            select(Agents)
            .where(or_(
                func.lower(Agents.name) == q_norm,          # exact
                func.lower(Agents.name).like(q_norm + '%'), # prefix
                func.lower(Agents.name).like(like_full),    # contains
                or_(*token_ors) if token_ors else literal(False)
            ))
            .limit(limit * 3)
        )
        agents = session.exec(stmt).all()

        # simple scoring (accumulative; no early returns)
        def _score(name: str) -> int:
            n = (name or "").lower()
            score = 0

            # Exact match to whole query string
            if n == q_norm:
                score += 100

            # Prefix (whole query)
            if n.startswith(q_norm):
                score += 70

            # Per-token boosts
            for t in toks:
                if n.startswith(t):
                    score += 20
                if t in n:
                    score += 10

            # Whole query appears somewhere (not already fully counted)
            if q_norm in n:
                score += 5

            # Length proximity bonus: shorter names closer to query get a bump.
            # Cap at 10, floor at 0 so long names don't go negative.
            gap = abs(len(n) - len(q_norm))
            score += max(0, 10 - gap)

            return score

        # Materialize first so we can annotate type + debug easily.
        raw_results: List[Dict[str, Any]] = []
        for a in agents:
            raw_results.append(
                {
                    "id": str(a.id),
                    "name": a.name,
                    "description": a.description,
                    # ensure numeric type for mypy & consumers
                    "score": int(_score(a.name or "")),
                }
            )

        # Sort highest score first, tie-break by name ASC.
        results = sorted(
            raw_results,
            key=lambda r: (-r["score"], r["name"]),
        )[:limit]
        return results

    except SQLAlchemyError as e:
        # Handle potential database errors gracefully
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()