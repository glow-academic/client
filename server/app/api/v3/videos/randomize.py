"""Video randomization endpoint - v3 API following DHH principles."""

import json
import random
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel


# Inline request/response schemas
class RandomizeVideoRequest(BaseModel):
    """Request to randomize video sections."""

    videoId: str | None = None
    profileId: str | None = None
    departmentIds: list[str] | None = None
    problemStatementIds: list[str] | None = None
    objectiveIds: list[str] | None = None
    policyIds: list[str] | None = None
    targets: list[str] = []  # ["problem_statement", "objectives", "policies"]


class RandomizeVideoResponse(BaseModel):
    """Response for video randomization."""

    success: bool
    message: str
    problemStatementIds: list[str] = []
    objectiveIds: list[str] = []
    policyIds: list[str] = []


router = APIRouter()


def parse_jsonb(data: Any) -> list[dict[str, Any]]:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
            if isinstance(parsed, list):
                return [dict(item) for item in parsed]
            return []
        except json.JSONDecodeError:
            return []
    if isinstance(data, list):
        return [dict(item) for item in data]
    return []


async def randomize_video_attributes(
    conn: asyncpg.Connection,
    problem_statement_ids: list[uuid.UUID] | None = None,
    objective_ids: list[uuid.UUID] | None = None,
    policy_ids: list[uuid.UUID] | None = None,
    department_ids: list[uuid.UUID] | None = None,
    video_id: uuid.UUID | None = None,
    profile_id: uuid.UUID | None = None,
    targets: list[str] | None = None,
) -> dict[str, Any]:
    """
    Randomize video attributes (problem statements, objectives, policies).

    Returns dict with keys:
        - problem_statement_ids: list[UUID]
        - objective_ids: list[UUID]
        - policy_ids: list[UUID]
    """
    if targets is None:
        targets = []

    # Step 1: Determine department_id for filtering
    selected_department_id: uuid.UUID | None = None
    if department_ids and len(department_ids) > 0:
        # Use provided departments, randomly pick one
        selected_department_id = random.choice(department_ids)
    elif profile_id:
        # Get profile's accessible departments
        sql = load_sql("sql/v3/profile/get_departments_for_profile.sql")
        profile_dept_rows = await conn.fetch(sql, str(profile_id))
        if profile_dept_rows and len(profile_dept_rows) > 0:
            profile_dept_ids = [uuid.UUID(str(row["id"])) for row in profile_dept_rows]
            selected_department_id = random.choice(profile_dept_ids)
    else:
        # Fallback to all active departments
        sql = load_sql("sql/v3/departments/get_all_active_departments.sql")
        all_dept_rows = await conn.fetch(sql)
        if all_dept_rows and len(all_dept_rows) > 0:
            all_dept_ids = [uuid.UUID(str(row["id"])) for row in all_dept_rows]
            selected_department_id = random.choice(all_dept_ids)

    if not selected_department_id:
        raise ValueError(
            "Cannot proceed without a department_id - no departments available"
        )

    # Step 2: Load randomization data
    dept_uuids = [selected_department_id]
    sql = load_sql("sql/v3/videos/get_randomization_data_complete.sql")
    result = await conn.fetchrow(sql, dept_uuids, video_id)

    if not result:
        raise ValueError("Failed to fetch randomization data")

    # Parse JSONB aggregations
    problem_statements_data = parse_jsonb(result.get("problem_statements", []))
    objectives_data = parse_jsonb(result.get("objectives", []))
    policies_data = parse_jsonb(result.get("policies", []))

    # Get existing links if video_id provided
    existing_problem_statement_ids = result.get("problem_statement_ids") or []
    existing_objective_ids = result.get("objective_ids") or []
    existing_policy_ids = result.get("policy_ids") or []

    # Step 3: Randomize based on targets
    final_problem_statement_ids: list[uuid.UUID] = []
    final_objective_ids: list[uuid.UUID] = []
    final_policy_ids: list[uuid.UUID] = []

    # Randomize problem statements
    if "problem_statement" in targets or len(targets) == 0:
        if problem_statements_data and len(problem_statements_data) > 0:
            # Pick 1 random problem statement
            selected_ps = random.choice(problem_statements_data)
            final_problem_statement_ids = [uuid.UUID(str(selected_ps["id"]))]
        elif existing_problem_statement_ids:
            # Keep existing if no options available
            final_problem_statement_ids = [
                uuid.UUID(psid) for psid in existing_problem_statement_ids
            ]
    else:
        # Keep existing
        final_problem_statement_ids = [
            uuid.UUID(psid) for psid in existing_problem_statement_ids
        ]

    # Randomize objectives (pick up to 3)
    if "objectives" in targets or len(targets) == 0:
        if objectives_data and len(objectives_data) > 0:
            # Pick 1-3 random objectives
            num_objectives = random.randint(1, min(3, len(objectives_data)))
            selected_objectives = random.sample(objectives_data, num_objectives)
            final_objective_ids = [
                uuid.UUID(str(obj["id"])) for obj in selected_objectives
            ]
        elif existing_objective_ids:
            # Keep existing if no options available
            final_objective_ids = [
                uuid.UUID(oid) for oid in existing_objective_ids
            ]
    else:
        # Keep existing
        final_objective_ids = [
            uuid.UUID(oid) for oid in existing_objective_ids
        ]

    # Randomize policies (pick 1-2)
    if "policies" in targets or len(targets) == 0:
        if policies_data and len(policies_data) > 0:
            # Pick 1-2 random policies
            num_policies = random.randint(1, min(2, len(policies_data)))
            selected_policies = random.sample(policies_data, num_policies)
            final_policy_ids = [
                uuid.UUID(str(pol["id"])) for pol in selected_policies
            ]
        elif existing_policy_ids:
            # Keep existing if no options available
            final_policy_ids = [
                uuid.UUID(pid) for pid in existing_policy_ids
            ]
    else:
        # Keep existing
        final_policy_ids = [uuid.UUID(pid) for pid in existing_policy_ids]

    return {
        "problem_statement_ids": final_problem_statement_ids,
        "objective_ids": final_objective_ids,
        "policy_ids": final_policy_ids,
    }


@router.post("/randomize", response_model=RandomizeVideoResponse)
async def randomize_video_sections(
    request: RandomizeVideoRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RandomizeVideoResponse:
    """Randomize video attributes (problem statements, objectives, policies)."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert string IDs to UUIDs
        problem_statement_ids = (
            [uuid.UUID(ps) for ps in request.problemStatementIds]
            if request.problemStatementIds
            else None
        )
        objective_ids = (
            [uuid.UUID(o) for o in request.objectiveIds] if request.objectiveIds else None
        )
        policy_ids = (
            [uuid.UUID(p) for p in request.policyIds] if request.policyIds else None
        )
        department_ids = (
            [uuid.UUID(d) for d in request.departmentIds]
            if request.departmentIds
            else None
        )
        video_id = uuid.UUID(request.videoId) if request.videoId else None
        profile_id = uuid.UUID(request.profileId) if request.profileId else None

        # Normalize empty lists
        if problem_statement_ids:
            problem_statement_ids = [ps for ps in problem_statement_ids if ps]
        if objective_ids:
            objective_ids = [o for o in objective_ids if o]
        if policy_ids:
            policy_ids = [p for p in policy_ids if p]
        if department_ids:
            department_ids = [d for d in department_ids if d]
        targets = [t for t in request.targets if t.strip()] if request.targets else []

        # Call core randomization function
        result = await randomize_video_attributes(
            conn=conn,
            problem_statement_ids=problem_statement_ids,
            objective_ids=objective_ids,
            policy_ids=policy_ids,
            department_ids=department_ids,
            video_id=video_id,
            profile_id=profile_id,
            targets=targets,
        )

        # Return response
        return RandomizeVideoResponse(
            success=True,
            message="Randomization completed successfully",
            problemStatementIds=[str(psid) for psid in result["problem_statement_ids"]],
            objectiveIds=[str(oid) for oid in result["objective_ids"]],
            policyIds=[str(pid) for pid in result["policy_ids"]],
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="randomize_video_sections",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

