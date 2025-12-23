"""Eval create endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline request/response schemas
class CreateEvalRequest(BaseModel):
    """Request to create an eval."""

    name: str
    description: str
    rubric_id: str
    agent_id: str  # Agent being evaluated
    eval_agent_id: str  # Agent performing evaluation
    model_run_ids: list[str]
    department_ids: list[str] | None = None
    active: bool = True
    dynamic: bool = (
        False  # If true, re-run agent being evaluated with modified system prompt
    )
    # profileId removed - comes from X-Profile-Id header
    run: bool = False  # Whether to run the eval immediately after creation


class CreateEvalResponse(BaseModel):
    """Response from create eval."""

    success: bool
    evalId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateEvalResponse,
    dependencies=[
        audit_activity(
            "eval.created", "{{ actor.name }} created eval '{{ eval.name }}'"
        )
    ],
)
async def create_eval(
    request: CreateEvalRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateEvalResponse:
    """Create a new eval."""
    tags = ["evals"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Validate rubric exists
            rubric_check = await conn.fetchrow(
                "SELECT id FROM rubrics WHERE id = $1 AND active = true",
                request.rubric_id,
            )
            if not rubric_check:
                raise ValueError(f"Rubric not found: {request.rubric_id}")

            # Validate model_run_ids exist
            if request.model_run_ids:
                model_run_ids_uuid = [uuid.UUID(mrid) for mrid in request.model_run_ids]
                existing_runs = await conn.fetch(
                    "SELECT id FROM runs WHERE id = ANY($1::uuid[])",
                    model_run_ids_uuid,
                )
                if len(existing_runs) != len(model_run_ids_uuid):
                    raise ValueError("One or more model_run_ids not found")

            # Convert model_run_ids to UUID array
            model_run_ids_uuid = (
                [uuid.UUID(mrid) for mrid in request.model_run_ids]
                if request.model_run_ids
                else []
            )

            # Validate agent exists (agent being evaluated)
            agent_check = await conn.fetchrow(
                "SELECT id FROM agents WHERE id = $1 AND active = true",
                request.agent_id,
            )
            if not agent_check:
                raise ValueError(f"Agent not found: {request.agent_id}")

            # Validate eval_agent exists (agent performing evaluation)
            eval_agent_check = await conn.fetchrow(
                "SELECT id FROM agents WHERE id = $1 AND active = true",
                request.eval_agent_id,
            )
            if not eval_agent_check:
                raise ValueError(f"Eval agent not found: {request.eval_agent_id}")

            # Convert department_ids to UUID array if provided
            department_ids_uuid = None
            if request.department_ids:
                department_ids_uuid = [uuid.UUID(did) for did in request.department_ids]

            # Create eval with model_runs and departments in single SQL (DHH style)
            sql_query = load_sql("app/sql/v3/evals/create_eval_complete.sql")
            sql_params = (
                request.name,
                request.description,
                request.rubric_id,
                request.agent_id,
                request.eval_agent_id,
                model_run_ids_uuid,
                department_ids_uuid,
                request.active,
                request.dynamic,
                profile_id,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to create eval")

            eval_id = result["eval_id"]
            actor_name = result.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    eval={"name": request.name, "id": eval_id},
                )

        result_data = CreateEvalResponse(
            success=True,
            evalId=eval_id,
            message=f"Eval '{request.name}' created successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
