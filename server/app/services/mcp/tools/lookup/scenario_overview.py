# scenario_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import Scenarios, Simulations
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def scenario_overview(scenario_id: str) -> Dict[str, Any]:
    """
    🎭 Scenario overview with metadata & usage
    -----------------------------------------
    Show scenario details and associated simulations.

    Input
      • scenario_id – UUID of the scenario

    Returns
      { "id": "…", "title": "…", "simulations": […], … }

    Quick-start
      ask:  "Show me details for scenario X"
      call: scenario_overview("uuid-here")

    See also 👉 simulation_overview() for sim details.
    """
    try:
        scenario_uuid = uuid.UUID(scenario_id)
    except ValueError:
        return {"error": f"Invalid scenario_id format: {scenario_id}"}

    session = next(get_session())
    try:
        # Get scenario details
        scenario = session.get(Scenarios, scenario_uuid)
        if not scenario:
            return {"error": f"Scenario not found: {scenario_id}"}

        # Get associated simulations via simulation_scenarios junction
        from app.models import SimulationScenarios
        sim_links = session.exec(
            select(SimulationScenarios)
            .where(SimulationScenarios.scenario_id == scenario_uuid)
        ).all()
        
        simulation_list = []
        if sim_links:
            sim_ids = [link.simulation_id for link in sim_links]
            simulations = session.exec(
                select(Simulations).where(Simulations.id.in_(sim_ids))
            ).all()
            
            for sim in simulations:
                simulation_list.append(
                    {
                        "id": str(sim.id),
                        "title": sim.title,
                        "active": sim.active,
                        "time_limit": sim.time_limit,
                        "created_at": sim.created_at.isoformat()
                        if sim.created_at
                        else None,
                    }
                )

        # Get persona from scenario_personas junction
        from app.models import ScenarioPersonas
        persona_link = session.exec(
            select(ScenarioPersonas).where(
                ScenarioPersonas.scenario_id == scenario.id,
                ScenarioPersonas.active == True
            )
        ).first()
        
        persona_id = str(persona_link.persona_id) if persona_link else None

        return {
            "id": str(scenario.id),
            "name": scenario.name,
            "problem_statement": scenario.problem_statement,
            "default_scenario": scenario.default_scenario,
            "persona_id": persona_id,
            "created_at": scenario.created_at.isoformat()
            if scenario.created_at
            else None,
            "updated_at": scenario.updated_at.isoformat()
            if scenario.updated_at
            else None,
            "simulations": simulation_list,
            "simulation_count": len(simulation_list),
        }

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
