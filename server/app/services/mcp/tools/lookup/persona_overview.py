# persona_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

import asyncpg  # type: ignore


async def persona_overview(conn: asyncpg.Connection, persona_id: str) -> Dict[str, Any]:
    """Persona details and associated scenarios."""
    try:
        persona_uuid = uuid.UUID(persona_id)
    except ValueError:
        return {"error": f"Invalid persona_id format: {persona_id}"}

    try:
        # Get persona details
        persona = await conn.fetchrow(
            """
            SELECT id, name, description, system_prompt, temperature, 
                    default_persona, created_at, updated_at
            FROM personas
            WHERE id = $1
            """,
            persona_uuid,
        )
        if not persona:
            return {"error": f"Persona not found: {persona_id}"}

        # Get associated scenarios via scenario_personas junction
        scenarios = await conn.fetch(
            """
            SELECT s.id, s.name, s.problem_statement, s.default_scenario, s.created_at
            FROM scenarios s
            JOIN scenario_personas sp ON sp.scenario_id = s.id
            WHERE sp.persona_id = $1 AND sp.active = true
            ORDER BY s.name
            """,
            persona_uuid,
        )

        scenario_list = [
            {
                "id": str(scenario["id"]),
                "name": scenario["name"],
                "problem_statement": scenario["problem_statement"],
                "default_scenario": scenario["default_scenario"],
                "created_at": scenario["created_at"].isoformat()
                if scenario["created_at"]
                else None,
            }
            for scenario in scenarios
        ]

        return {
            "id": str(persona["id"]),
            "name": persona["name"],
            "description": persona["description"],
            "system_prompt": persona["system_prompt"],
            "temperature": float(persona["temperature"]) if persona["temperature"] else None,
            "default_persona": persona["default_persona"],
            "created_at": persona["created_at"].isoformat()
            if persona["created_at"]
            else None,
            "updated_at": persona["updated_at"].isoformat()
            if persona["updated_at"]
            else None,
            "scenarios": scenario_list,
            "scenario_count": len(scenario_list),
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
