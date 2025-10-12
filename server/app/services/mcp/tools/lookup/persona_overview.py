# persona_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import Personas, Scenarios
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def persona_overview(persona_id: str) -> Dict[str, Any]:
    """
    Persona overview
    --------------
    Show persona details and associated simulations.

    Input
      • persona_id - UUID of the persona

    Returns
      { "id": "…", "name": "…", "simulations": […], … }

    Quick-start
      ask:  "Show me details for persona X"
      call: persona_overview("uuid-here")

    See also 👉 simulation_overview() for sim details.
    """
    try:
        persona_uuid = uuid.UUID(persona_id)
    except ValueError:
        return {"error": f"Invalid persona_id format: {persona_id}"}

    session = next(get_session())
    try:
        # Get persona details
        persona = session.get(Personas, persona_uuid)
        if not persona:
            return {"error": f"Persona not found: {persona_id}"}

        # Get associated scenarios (personas are linked directly to scenarios)
        scenarios_stmt = select(Scenarios).where(Scenarios.persona_id == persona_uuid)
        scenarios = session.exec(scenarios_stmt).all()

        scenario_list = []
        for scenario in scenarios:
            scenario_list.append(
                {
                    "id": str(scenario.id),
                    "name": scenario.name,
                    "problem_statement": scenario.problem_statement,
                    "default_scenario": scenario.default_scenario,
                    "created_at": scenario.created_at.isoformat()
                    if scenario.created_at
                    else None,
                }
            )

        return {
            "id": str(persona.id),
            "name": persona.name,
            "description": persona.description,
            "system_prompt": persona.system_prompt,
            "temperature": persona.temperature,
            "default_persona": persona.default_persona,
            "created_at": persona.created_at.isoformat()
            if persona.created_at
            else None,
            "updated_at": persona.updated_at.isoformat()
            if persona.updated_at
            else None,
            "scenarios": scenario_list,
            "scenario_count": len(scenario_list),
        }

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
