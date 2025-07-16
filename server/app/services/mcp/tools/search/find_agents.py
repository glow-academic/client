# find_agents.py

from typing import Any, Dict, List

from app.db import get_session
from app.models import Agents
from sqlalchemy import func
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
        # Create a case-insensitive search pattern
        search_pattern = f"%{query.lower()}%"

        # Build the query statement
        stmt = (
            select(Agents)
            .where(func.lower(Agents.name).like(search_pattern))
            .limit(limit)
        )

        # Execute the query
        agents = session.exec(stmt).all()

        # Format the results
        results = []
        for agent in agents:
            results.append(
                {
                    "id": str(agent.id),
                    "name": agent.name,
                    "description": agent.description,
                }
            )

        return results

    except SQLAlchemyError as e:
        # Handle potential database errors gracefully
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()