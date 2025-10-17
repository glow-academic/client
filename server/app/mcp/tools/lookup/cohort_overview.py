# cohort_overview.py
import uuid
from typing import Any, Dict

import asyncpg  # type: ignore


async def cohort_overview(conn: asyncpg.Connection, cohort_id: str) -> Dict[str, Any]:
    """Cohort meta, roster, active sims, and pass-rate."""
    try:
        cohort_uuid = uuid.UUID(cohort_id)
    except ValueError:
        return {"error": f"Invalid cohort_id format: {cohort_id}"}

    try:
        # Get cohort
        cohort = await conn.fetchrow(
            """
            SELECT id, title, description, active, created_at
            FROM cohorts
            WHERE id = $1
            """,
            cohort_uuid,
        )
        if not cohort:
            return {"error": f"Cohort not found: {cohort_id}"}

        cohort_data = {
            "id": str(cohort["id"]),
            "title": cohort["title"],
            "description": cohort["description"],
            "active": cohort["active"],
            "created_at": cohort["created_at"].isoformat() if cohort["created_at"] else None,
        }

        # Load profiles from cohort_profiles junction table
        profiles = await conn.fetch(
            """
            SELECT p.id, p.first_name, p.last_name, p.alias, p.role
            FROM profiles p
            JOIN cohort_profiles cp ON cp.profile_id = p.id
            WHERE cp.cohort_id = $1 AND cp.active = true
            ORDER BY p.last_name, p.first_name
            """,
            cohort_uuid,
        )

        roster = [
            {
                "id": str(profile["id"]),
                "first_name": profile["first_name"],
                "last_name": profile["last_name"],
                "alias": profile["alias"],
                "role": profile["role"],
            }
            for profile in profiles
        ]

        # Load simulations from cohort_simulations junction table
        simulations = await conn.fetch(
            """
            SELECT s.id, s.title, s.active, s.time_limit
            FROM simulations s
            JOIN cohort_simulations cs ON cs.simulation_id = s.id
            WHERE cs.cohort_id = $1 AND cs.active = true AND s.active = true
            ORDER BY s.title
            """,
            cohort_uuid,
        )

        simulations_data = [
            {
                "id": str(sim["id"]),
                "title": sim["title"],
                "active": sim["active"],
                "time_limit": sim["time_limit"],
            }
            for sim in simulations
        ]

        # Calculate basic stats
        total_students = len(roster)
        active_simulations = len(simulations_data)

        return {
            "cohort": cohort_data,
            "roster": roster,
            "simulations": simulations_data,
            "stats": {
                "total_students": total_students,
                "active_simulations": active_simulations,
            },
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
