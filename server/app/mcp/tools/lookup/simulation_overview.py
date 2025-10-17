# simulation_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

import asyncpg  # type: ignore


async def simulation_overview(conn: asyncpg.Connection, sim_id: str) -> Dict[str, Any]:
    """Simulation meta, rubric, cohorts, scenarios, and pass stats."""
    try:
        simulation_uuid = uuid.UUID(sim_id)
    except ValueError:
        return {"error": f"Invalid sim_id format: {sim_id}"}

    try:
        # Get simulation
        simulation = await conn.fetchrow(
            """
            SELECT id, title, active, time_limit, rubric_id, created_at
            FROM simulations
            WHERE id = $1
            """,
            simulation_uuid,
        )
        if not simulation:
            return {"error": f"Simulation not found: {sim_id}"}

        simulation_data = {
            "id": str(simulation["id"]),
            "title": simulation["title"],
            "active": simulation["active"],
            "time_limit": simulation["time_limit"],
            "created_at": simulation["created_at"].isoformat()
            if simulation["created_at"]
            else None,
        }

        # Get rubric
        rubric_data = {}
        if simulation["rubric_id"]:
            rubric = await conn.fetchrow(
                """
                SELECT id, name, description, points, pass_points
                FROM rubrics
                WHERE id = $1
                """,
                simulation["rubric_id"],
            )
            if rubric:
                rubric_data = {
                    "id": str(rubric["id"]),
                    "name": rubric["name"],
                    "description": rubric["description"],
                    "points": rubric["points"],
                    "pass_points": rubric["pass_points"],
                }

        # Get cohorts via cohort_simulations junction
        cohorts = await conn.fetch(
            """
            SELECT c.id, c.title, c.active
            FROM cohorts c
            JOIN cohort_simulations cs ON cs.cohort_id = c.id
            WHERE cs.simulation_id = $1 AND cs.active = true
            ORDER BY c.title
            """,
            simulation_uuid,
        )

        cohorts_data = [
            {
                "id": str(cohort["id"]),
                "title": cohort["title"],
                "active": cohort["active"],
            }
            for cohort in cohorts
        ]

        # Load scenarios from junction table (ordered by position)
        scenarios = await conn.fetch(
            """
            SELECT s.id, s.name, s.problem_statement, ss.position
            FROM scenarios s
            JOIN simulation_scenarios ss ON ss.scenario_id = s.id
            WHERE ss.simulation_id = $1
            ORDER BY ss.position
            """,
            simulation_uuid,
        )

        scenarios_data = [
            {
                "id": str(scenario["id"]),
                "name": scenario["name"],
                "problem_statement": scenario["problem_statement"],
                "position": scenario["position"],
            }
            for scenario in scenarios
        ]

        # Calculate pass stats
        stats = await conn.fetchrow(
            """
            WITH attempt_stats AS (
                SELECT 
                    COUNT(DISTINCT sa.id) as total_attempts,
                    COUNT(DISTINCT scg.id) as total_graded,
                    SUM(CASE WHEN scg.passed = true THEN 1 ELSE 0 END) as total_passed
                FROM simulation_attempts sa
                LEFT JOIN simulation_chats sc ON sc.attempt_id = sa.id
                LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
                WHERE sa.simulation_id = $1
            )
            SELECT 
                total_attempts,
                total_graded,
                CASE 
                    WHEN total_graded > 0 
                    THEN ROUND((total_passed::numeric / total_graded * 100), 2)
                    ELSE 0
                END as pass_rate
            FROM attempt_stats
            """,
            simulation_uuid,
        )

        return {
            "simulation": simulation_data,
            "rubric": rubric_data,
            "cohorts": cohorts_data,
            "scenarios": scenarios_data,
            "stats": {
                "total_attempts": stats["total_attempts"] if stats else 0,
                "total_graded": stats["total_graded"] if stats else 0,
                "pass_rate": float(stats["pass_rate"]) if stats and stats["pass_rate"] else 0,
            },
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
