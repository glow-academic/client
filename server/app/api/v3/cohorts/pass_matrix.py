"""Cohort pass matrix endpoint - v3 API."""

import json
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import get_pool, server
from app.utils.sql_helper import load_sql

router = APIRouter()


class CohortPassMatrixRequest(BaseModel):
    """Request to get cohort pass matrix."""

    cohort_id: str


class CohortPassMatrixResponse(BaseModel):
    """Response with cohort pass matrix data."""

    cohort: dict[str, Any]
    matrix: list[dict[str, Any]]
    summary: dict[str, Any]
    simulations: list[dict[str, Any]]


@router.post("/pass-matrix", response_model=CohortPassMatrixResponse)
@server.tool()
async def cohort_pass_matrix(
    request: CohortPassMatrixRequest,
) -> CohortPassMatrixResponse:
    """
    Cohort pass/fail matrix across simulations
    Show pass/fail rates for all students in a cohort.

    Input
      • cohort_id - UUID of the cohort

    Returns
      { "cohort": {…}, "matrix": [{…}], "summary": {…} }

    Quick-start
      ask:  "Show pass rates for cohort X"
      call: cohort_pass_matrix("uuid-here")

    See also cohort_overview() for cohort details.
    """
    try:
        cohort_uuid = uuid.UUID(request.cohort_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid cohort_id format: {request.cohort_id}"
        ) from None

    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/cohorts/pass_matrix.sql")
            cohort_data = await conn.fetchrow(sql, cohort_uuid)

            if not cohort_data:
                raise HTTPException(
                    status_code=404, detail=f"Cohort not found: {request.cohort_id}"
                )

            # Parse JSON fields
            members = cohort_data["members"] if cohort_data["members"] else []
            if isinstance(members, str):
                members = json.loads(members)
            simulations = (
                cohort_data["simulations"] if cohort_data["simulations"] else []
            )
            if isinstance(simulations, str):
                simulations = json.loads(simulations)
            student_results = (
                cohort_data["student_results"] if cohort_data["student_results"] else {}
            )
            if isinstance(student_results, str):
                student_results = json.loads(student_results)

            # Build pass/fail matrix
            matrix = []
            for student in members:
                student_id = str(student["id"])
                student_name = f"{student['first_name'] or ''} {student['last_name'] or ''}".strip()
                if not student_name:
                    student_name = student["email"] or "Unknown"

                student_row: dict[str, Any] = {
                    "student_id": student_id,
                    "student_name": student_name,
                    "email": student["email"],
                    "simulations": {},
                }

                # Get pre-fetched results for this student
                student_sim_results = student_results.get(student_id, {})

                # Build results for each simulation
                for sim in simulations:
                    sim_id = str(sim["id"])
                    result_data = student_sim_results.get(sim_id)

                    if result_data:
                        student_row["simulations"][sim_id] = {
                            "score": result_data["score"],
                            "passed": result_data["passed"],
                            "time_taken": result_data["time_taken"],
                            "attempt_count": result_data["attempt_count"],
                            "last_attempt": result_data["last_attempt"],
                        }
                    else:
                        student_row["simulations"][sim_id] = None

                matrix.append(student_row)

            # Calculate summary statistics
            summary: dict[str, Any] = {
                "total_students": len(members),
                "total_simulations": len(simulations),
                "simulation_stats": {},
            }

            for sim in simulations:
                sim_id = str(sim["id"])
                passed_count = 0
                attempted_count = 0
                total_score = 0

                for student_result in matrix:
                    result = student_result["simulations"].get(sim_id)
                    if result:
                        attempted_count += 1
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

            return CohortPassMatrixResponse(
                cohort={
                    "id": str(cohort_data["id"]),
                    "title": cohort_data["title"],
                    "description": cohort_data["description"],
                    "active": cohort_data["active"],
                    "created_at": cohort_data["created_at"].isoformat()
                    if cohort_data["created_at"]
                    else None,
                },
                matrix=matrix,
                summary=summary,
                simulations=simulations,
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
