# scenario_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

import asyncpg  # type: ignore


async def scenario_overview(conn: asyncpg.Connection, scenario_id: str) -> Dict[str, Any]:
    """Scenario details and associated simulations."""
    try:
        scenario_uuid = uuid.UUID(scenario_id)
    except ValueError:
        return {"error": f"Invalid scenario_id format: {scenario_id}"}

    try:
        # Get scenario details
        scenario = await conn.fetchrow(
            """
            SELECT id, name, problem_statement, default_scenario, created_at, updated_at
            FROM scenarios
            WHERE id = $1
            """,
            scenario_uuid,
        )
        if not scenario:
            return {"error": f"Scenario not found: {scenario_id}"}

        # Get associated simulations via simulation_scenarios junction
        simulations = await conn.fetch(
            """
            SELECT s.id, s.title, s.active, s.time_limit, s.created_at
            FROM simulations s
            JOIN simulation_scenarios ss ON ss.simulation_id = s.id
            WHERE ss.scenario_id = $1
            ORDER BY s.title
            """,
            scenario_uuid,
        )

        simulation_list = [
            {
                "id": str(sim["id"]),
                "title": sim["title"],
                "active": sim["active"],
                "time_limit": sim["time_limit"],
                "created_at": sim["created_at"].isoformat()
                if sim["created_at"]
                else None,
            }
            for sim in simulations
        ]

        # Get persona from scenario_personas junction
        persona_link = await conn.fetchrow(
            """
            SELECT persona_id
            FROM scenario_personas
            WHERE scenario_id = $1 AND active = true
            LIMIT 1
            """,
            scenario_uuid,
        )

        persona_id = str(persona_link["persona_id"]) if persona_link else None

        return {
            "id": str(scenario["id"]),
            "name": scenario["name"],
            "problem_statement": scenario["problem_statement"],
            "default_scenario": scenario["default_scenario"],
            "persona_id": persona_id,
            "created_at": scenario["created_at"].isoformat()
            if scenario["created_at"]
            else None,
            "updated_at": scenario["updated_at"].isoformat()
            if scenario["updated_at"]
            else None,
            "simulations": simulation_list,
            "simulation_count": len(simulation_list),
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
