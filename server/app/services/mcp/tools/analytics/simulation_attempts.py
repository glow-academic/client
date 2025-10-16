# simulation_attempts.py
import uuid
from typing import Any, Dict, List

import asyncpg  # type: ignore


async def simulation_attempts(conn: asyncpg.Connection, sim_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    """
    Flat list of attempts (who, when, score)
    List all attempts for a specific simulation.

    Input
      • conn - Database connection from asyncpg
      • sim_id - UUID of the simulation
      • limit - Max results (default: 200)

    Returns
      [ { "id": "…", "student": "…", "score": 85, … }, … ]

    Quick-start
      ask:  "List last 200 attempts on Sim Y"
      call: simulation_attempts(conn, "uuid-here")

    See also simulation_overview() for aggregate stats.
    """
    try:
        simulation_uuid = uuid.UUID(sim_id)
    except ValueError:
        return [{"error": f"Invalid sim_id format: {sim_id}"}]

    try:
        # Verify simulation exists
        simulation = await conn.fetchrow(
            "SELECT id FROM simulations WHERE id = $1",
            simulation_uuid,
        )
        if not simulation:
            return [{"error": f"Simulation not found: {sim_id}"}]

        # Get all attempts for this simulation with student info and grades
        attempts = await conn.fetch(
            """
            WITH attempt_data AS (
                SELECT 
                    sa.id,
                    sa.created_at,
                    ap.profile_id,
                    p.first_name,
                    p.last_name,
                    p.alias
                FROM simulation_attempts sa
                LEFT JOIN attempt_profiles ap ON sa.id = ap.attempt_id AND ap.active = true
                LEFT JOIN profiles p ON p.id = ap.profile_id
                WHERE sa.simulation_id = $1
                ORDER BY sa.created_at DESC
                LIMIT $2
            ),
            latest_grades AS (
                SELECT DISTINCT ON (sc.attempt_id)
                    sc.attempt_id,
                    scg.score,
                    scg.passed,
                    scg.time_taken
                FROM simulation_chats sc
                JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
                WHERE sc.attempt_id IN (SELECT id FROM attempt_data)
                ORDER BY sc.attempt_id, sc.created_at DESC
            )
            SELECT 
                ad.id,
                ad.created_at,
                ad.profile_id,
                ad.first_name,
                ad.last_name,
                ad.alias,
                lg.score,
                lg.passed,
                lg.time_taken
            FROM attempt_data ad
            LEFT JOIN latest_grades lg ON lg.attempt_id = ad.id
            ORDER BY ad.created_at DESC
            """,
            simulation_uuid,
            limit,
        )

        results = []
        for attempt in attempts:
            # Build student name
            student_name = "Unknown"
            if attempt["first_name"] or attempt["last_name"]:
                name_parts = []
                if attempt["first_name"]:
                    name_parts.append(attempt["first_name"])
                if attempt["last_name"]:
                    name_parts.append(attempt["last_name"])
                student_name = " ".join(name_parts)
            elif attempt["alias"]:
                student_name = attempt["alias"]

            results.append({
                "id": str(attempt["id"]),
                "student": student_name,
                "student_id": str(attempt["profile_id"]) if attempt["profile_id"] else None,
                "score": attempt["score"],
                "passed": attempt["passed"],
                "time_taken": attempt["time_taken"],
                "created_at": attempt["created_at"].isoformat() if attempt["created_at"] else None,
            })

        return results

    except Exception as e:
        return [{"error": f"Database error: {str(e)}"}]
