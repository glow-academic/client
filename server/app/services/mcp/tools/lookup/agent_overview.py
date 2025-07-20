# agent_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import Agents, Scenarios
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def agent_overview(agent_id: str) -> Dict[str, Any]:
    """
    Agent overview
    --------------
    Show agent details and associated simulations.

    Input
      • agent_id - UUID of the agent

    Returns
      { "id": "…", "name": "…", "simulations": […], … }

    Quick-start
      ask:  "Show me details for agent X"
      call: agent_overview("uuid-here")

    See also 👉 simulation_overview() for sim details.
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return {"error": f"Invalid agent_id format: {agent_id}"}

    session = next(get_session())
    try:
        # Get agent details
        agent = session.get(Agents, agent_uuid)
        if not agent:
            return {"error": f"Agent not found: {agent_id}"}

        # Get associated scenarios (agents are linked directly to scenarios)
        scenarios_stmt = select(Scenarios).where(Scenarios.agent_id == agent_uuid)
        scenarios = session.exec(scenarios_stmt).all()

        scenario_list = []
        for scenario in scenarios:
            scenario_list.append(
                {
                    "id": str(scenario.id),
                    "name": scenario.name,
                    "description": scenario.description,
                    "default_scenario": scenario.default_scenario,
                    "created_at": scenario.created_at.isoformat()
                    if scenario.created_at
                    else None,
                }
            )

        return {
            "id": str(agent.id),
            "name": agent.name,
            "description": agent.description,
            "system_prompt": agent.system_prompt,
            "temperature": agent.temperature,
            "default_agent": agent.default_agent,
            "created_at": agent.created_at.isoformat() if agent.created_at else None,
            "updated_at": agent.updated_at.isoformat() if agent.updated_at else None,
            "scenarios": scenario_list,
            "scenario_count": len(scenario_list),
        }

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
