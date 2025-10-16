# cohort_pass_matrix.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

import asyncpg  # type: ignore


async def cohort_pass_matrix(conn: asyncpg.Connection, cohort_id: str) -> Dict[str, Any]:
    """
    Cohort pass/fail matrix across simulations
    Show pass/fail rates for all students in a cohort.

    Input
      • conn - Database connection from asyncpg
      • cohort_id - UUID of the cohort

    Returns
      { "cohort": {…}, "matrix": [{…}], "summary": {…} }

    Quick-start
      ask:  "Show pass rates for cohort X"
      call: cohort_pass_matrix(conn, "uuid-here")

    See also cohort_overview() for cohort details.
    """
    try:
        cohort_uuid = uuid.UUID(cohort_id)
    except ValueError:
        return {"error": f"Invalid cohort_id format: {cohort_id}"}

    try:
        # Get cohort details
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

        # Get cohort members via cohort_profiles junction
        cohort_members = await conn.fetch(
            """
            SELECT p.id, p.first_name, p.last_name, p.alias
            FROM profiles p
            JOIN cohort_profiles cp ON p.id = cp.profile_id
            WHERE cp.cohort_id = $1 AND cp.active = true
            """,
            cohort_uuid,
        )

        # Get simulations for this cohort via cohort_simulations junction
        cohort_simulations = await conn.fetch(
            """
            SELECT s.id, s.title, s.active, s.time_limit
            FROM simulations s
            JOIN cohort_simulations cs ON s.id = cs.simulation_id
            WHERE cs.cohort_id = $1 AND cs.active = true
            """,
            cohort_uuid,
        )

        # Build pass/fail matrix
        matrix = []
        for student in cohort_members:
            student_name = f"{student['first_name'] or ''} {student['last_name'] or ''}".strip()
            if not student_name:
                student_name = student["alias"] or "Unknown"

            student_results: Dict[str, Any] = {
                "student_id": str(student["id"]),
                "student_name": student_name,
                "alias": student["alias"],
                "simulations": {},
            }

            # Get results for each simulation
            for sim in cohort_simulations:
                # Get best grade for this student and simulation
                best_result_row = await conn.fetchrow(
                    """
                    WITH student_attempts AS (
                        SELECT sa.id AS attempt_id, sa.created_at
                        FROM simulation_attempts sa
                        JOIN attempt_profiles ap ON sa.id = ap.attempt_id
                        WHERE ap.profile_id = $1
                          AND ap.active = true
                          AND sa.simulation_id = $2
                    ),
                    chat_grades AS (
                        SELECT 
                            sa.attempt_id,
                            sa.created_at,
                            scg.score,
                            scg.passed,
                            scg.time_taken,
                            ROW_NUMBER() OVER (
                                PARTITION BY sa.attempt_id 
                                ORDER BY sc.created_at DESC
                            ) as rn
                        FROM student_attempts sa
                        JOIN simulation_chats sc ON sc.attempt_id = sa.attempt_id
                        JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
                    )
                    SELECT 
                        MAX(score) as best_score,
                        BOOL_OR(passed) as passed,
                        (ARRAY_AGG(time_taken ORDER BY score DESC))[1] as time_taken,
                        COUNT(DISTINCT attempt_id) as attempt_count,
                        MAX(created_at) as last_attempt
                    FROM chat_grades
                    WHERE rn = 1
                    """,
                    student["id"],
                    sim["id"],
                )

                if best_result_row and best_result_row["best_score"] is not None:
                    best_result = {
                        "score": best_result_row["best_score"],
                        "passed": best_result_row["passed"],
                        "time_taken": best_result_row["time_taken"],
                        "attempt_count": best_result_row["attempt_count"],
                        "last_attempt": best_result_row["last_attempt"].isoformat()
                        if best_result_row["last_attempt"]
                        else None,
                    }
                else:
                    best_result = None

                student_results["simulations"][str(sim["id"])] = best_result

            matrix.append(student_results)

        # Calculate summary statistics
        summary: Dict[str, Any] = {
            "total_students": len(cohort_members),
            "total_simulations": len(cohort_simulations),
            "simulation_stats": {},
        }

        for sim in cohort_simulations:
            sim_id = str(sim["id"])
            passed_count = 0
            attempted_count = 0
            total_score = 0

            for student_result in matrix:
                if (
                    sim_id in student_result["simulations"]
                    and student_result["simulations"][sim_id]
                ):
                    attempted_count += 1
                    result = student_result["simulations"][sim_id]
                    if result["passed"]:
                        passed_count += 1
                    total_score += result["score"]

            summary["simulation_stats"][sim_id] = {
                "simulation_title": sim["title"],
                "attempted_count": attempted_count,
                "passed_count": passed_count,
                "pass_rate": round(passed_count / attempted_count * 100, 1)
                if attempted_count > 0
                else 0,
                "average_score": round(total_score / attempted_count, 1)
                if attempted_count > 0
                else 0,
            }

        return {
            "cohort": {
                "id": str(cohort["id"]),
                "title": cohort["title"],
                "description": cohort["description"],
                "active": cohort["active"],
                "created_at": cohort["created_at"].isoformat()
                if cohort["created_at"]
                else None,
            },
            "matrix": matrix,
            "summary": summary,
            "simulations": [
                {
                    "id": str(sim["id"]),
                    "title": sim["title"],
                    "active": sim["active"],
                    "time_limit": sim["time_limit"],
                }
                for sim in cohort_simulations
            ],
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
