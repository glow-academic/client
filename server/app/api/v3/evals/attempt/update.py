"""Eval attempt update endpoint - allows updating conversation settings."""

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
class UpdateEvalAttemptRequest(BaseModel):
    """Request to update an eval attempt."""

    attemptId: str
    conversation_mode: bool | None = None
    conversation_agent_id: str | None = None
    conversation_max_turns: int | None = None
    # profileId removed - comes from X-Profile-Id header


class UpdateEvalAttemptResponse(BaseModel):
    """Response from update eval attempt."""

    success: bool
    attemptId: str
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateEvalAttemptResponse,
    dependencies=[
        audit_activity(
            "eval.attempt.updated", "{{ actor.name }} updated eval attempt settings"
        )
    ],
)
async def update_eval_attempt(
    request: UpdateEvalAttemptRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateEvalAttemptResponse:
    """Update eval attempt conversation settings."""
    tags = ["evals", "attempts"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Validate attempt exists
            attempt_check = await conn.fetchrow(
                "SELECT id FROM eval_attempts WHERE id = $1",
                request.attemptId,
            )
            if not attempt_check:
                raise ValueError(f"Eval attempt not found: {request.attemptId}")

            # Validate conversation_agent_id if provided
            conversation_agent_id_uuid = None
            if request.conversation_agent_id:
                conversation_agent_id_uuid = uuid.UUID(request.conversation_agent_id)
                agent_check = await conn.fetchrow(
                    "SELECT id FROM agents WHERE id = $1 AND active = true",
                    conversation_agent_id_uuid,
                )
                if not agent_check:
                    raise ValueError(
                        f"Conversation agent not found: {request.conversation_agent_id}"
                    )

            # Validate conversation_max_turns if provided
            if request.conversation_max_turns is not None:
                if request.conversation_max_turns <= 0:
                    raise ValueError("conversation_max_turns must be greater than 0")

            # Update eval attempt
            sql_query = load_sql("sql/v3/evals/update_eval_attempt.sql")
            sql_params = (
                request.attemptId,
                request.conversation_mode,
                conversation_agent_id_uuid,
                request.conversation_max_turns,
                profile_id,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to update eval attempt")

            attempt_id = result["attempt_id"]
            actor_name = result["actor_name"]
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                )

        result_data = UpdateEvalAttemptResponse(
            success=True,
            attemptId=attempt_id,
            message="Eval attempt updated successfully",
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
            operation="update_eval_attempt",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
