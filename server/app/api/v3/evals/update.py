"""Eval update endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class UpdateEvalRequest(BaseModel):
    """Request to update an eval."""

    evalId: str
    name: str
    description: str
    rubric_id: str
    agent_id: str | None = None  # Agent being evaluated
    eval_agent_id: str | None = None  # Agent performing evaluation
    model_run_ids: list[str] | None = None  # If provided, replaces all existing
    department_ids: list[str] | None = None  # If provided, replaces all existing
    active: bool | None = None
    dynamic: bool | None = (
        None  # If true, re-run agent being evaluated with modified system prompt
    )
    # profileId removed - comes from X-Profile-Id header


class UpdateEvalResponse(BaseModel):
    """Response from update eval."""

    success: bool
    evalId: str
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateEvalResponse,
    dependencies=[
        audit_activity(
            "eval.updated", "{{ actor.name }} updated eval '{{ eval.name }}'"
        )
    ],
)
async def update_eval(
    request: UpdateEvalRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateEvalResponse:
    """Update an existing eval."""
    tags = ["evals"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        async with transaction(conn):
            # Validate eval exists
            eval_check = await conn.fetchrow(
                "SELECT id FROM evals WHERE id = $1",
                request.evalId,
            )
            if not eval_check:
                raise ValueError(f"Eval not found: {request.evalId}")

            # Validate rubric exists
            rubric_check = await conn.fetchrow(
                "SELECT id FROM rubrics WHERE id = $1 AND active = true",
                request.rubric_id,
            )
            if not rubric_check:
                raise ValueError(f"Rubric not found: {request.rubric_id}")

            # Validate model_run_ids if provided
            model_run_ids_uuid = None
            if request.model_run_ids:
                model_run_ids_uuid = [uuid.UUID(mrid) for mrid in request.model_run_ids]
                existing_runs = await conn.fetch(
                    "SELECT id FROM runs WHERE id = ANY($1::uuid[])",
                    model_run_ids_uuid,
                )
                if len(existing_runs) != len(model_run_ids_uuid):
                    raise ValueError("One or more model_run_ids not found")

            # Convert department_ids to UUID array if provided
            department_ids_uuid = None
            if request.department_ids:
                department_ids_uuid = [uuid.UUID(did) for did in request.department_ids]

            # Update eval
            sql_query = load_sql("sql/v3/evals/update_eval.sql")
            sql_params = (
                request.evalId,
                request.name,
                request.description,
                request.rubric_id,
                uuid.UUID(request.agent_id) if request.agent_id else None,
                uuid.UUID(request.eval_agent_id) if request.eval_agent_id else None,
                model_run_ids_uuid,
                department_ids_uuid,
                request.active,
                request.dynamic,
                profile_id,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to update eval")

            eval_id = result["eval_id"]
            eval_name = result["eval_name"]
            actor_name = result["actor_name"]
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    eval={"name": eval_name, "id": eval_id},
                )

        result_data = UpdateEvalResponse(
            success=True,
            evalId=eval_id,
            message=f"Eval '{request.name}' updated successfully",
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
            operation="update_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
