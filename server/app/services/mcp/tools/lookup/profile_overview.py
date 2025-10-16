# profile_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

import asyncpg  # type: ignore


async def profile_overview(conn: asyncpg.Connection, profile_id: str) -> Dict[str, Any]:
    """Profile overview with last login, classes, dashboard flags, and latest grades."""
    try:
        # Try UUID first
        profile = None
        try:
            profile_uuid = uuid.UUID(profile_id)
            profile = await conn.fetchrow(
                """
                SELECT id, first_name, last_name, alias, role, last_login,
                        viewed_intro, active, created_at
                FROM profiles
                WHERE id = $1
                """,
                profile_uuid,
            )
        except ValueError:
            # Search by name
            search_pattern = f"%{profile_id.lower()}%"
            profile = await conn.fetchrow(
                """
                SELECT id, first_name, last_name, alias, role, last_login,
                        viewed_intro, active, created_at
                FROM profiles
                WHERE LOWER(first_name) LIKE $1
                    OR LOWER(last_name) LIKE $1
                    OR LOWER(alias) LIKE $1
                LIMIT 1
                """,
                search_pattern,
            )

        if not profile:
            return {"error": f"Profile not found: {profile_id}"}

        # Get profile data
        profile_data = {
            "id": str(profile["id"]),
            "first_name": profile["first_name"],
            "last_name": profile["last_name"],
            "alias": profile["alias"],
            "role": profile["role"],
            "last_login": profile["last_login"].isoformat()
            if profile["last_login"]
            else None,
            "viewed_intro": profile["viewed_intro"],
            "active": profile["active"],
            "created_at": profile["created_at"].isoformat()
            if profile["created_at"]
            else None,
        }

        # Get latest simulation grades (last 5) via attempt_profiles junction
        latest_grades_data = await conn.fetch(
            """
            WITH latest_attempts AS (
                SELECT sa.id, sa.simulation_id, sa.created_at
                FROM simulation_attempts sa
                JOIN attempt_profiles ap ON ap.attempt_id = sa.id
                WHERE ap.profile_id = $1 AND ap.active = true
                ORDER BY sa.created_at DESC
                LIMIT 5
            ),
            attempt_grades AS (
                SELECT 
                    s.title as simulation_title,
                    scg.score,
                    scg.passed,
                    scg.time_taken,
                    scg.created_at,
                    ROW_NUMBER() OVER (PARTITION BY la.id ORDER BY sc.created_at DESC) as rn
                FROM latest_attempts la
                JOIN simulations s ON s.id = la.simulation_id
                JOIN simulation_chats sc ON sc.attempt_id = la.id
                JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            )
            SELECT simulation_title, score, passed, time_taken, created_at
            FROM attempt_grades
            WHERE rn = 1
            ORDER BY created_at DESC
            """,
            profile["id"],
        )

        latest_grades = [
            {
                "simulation_title": grade["simulation_title"],
                "score": float(grade["score"]) if grade["score"] else None,
                "passed": grade["passed"],
                "time_taken": grade["time_taken"],
                "created_at": grade["created_at"].isoformat(),
            }
            for grade in latest_grades_data
        ]

        return {
            "profile": profile_data,
            "latest_grades": latest_grades,
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
