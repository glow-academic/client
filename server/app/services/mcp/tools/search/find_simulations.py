# find_simulations.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict, List

from app.db import get_session
from app.models import Simulations
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def find_simulations(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find simulations by title
    ----------------------------
    Fuzzy sim title search.

    Input
      • query – Simulation title to search for
      • limit – Max results (default: 10)

    Returns
      [ { "id": "…", "title": "…", "active": true, … }, … ]

    Quick-start
      ask:  "Which sims mention 'cardiac'?"
      call: find_simulations("cardiac")

    See also 👉 simulation_overview() for detailed sim data.
    """
    session = next(get_session())
    try:
        search_pattern = f"%{query.lower()}%"
        stmt = (
            select(Simulations)
            .where(func.lower(Simulations.title).like(search_pattern))
            .limit(limit)
        )

        simulations = session.exec(stmt).all()

        results = [
            {
                "id": str(sim.id),
                "title": sim.title,
                "active": sim.active,
                "time_limit": sim.time_limit,
                "created_at": sim.created_at.isoformat(),
            }
            for sim in simulations
        ]

        return results

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()
