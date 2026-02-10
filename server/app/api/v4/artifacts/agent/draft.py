"""Agent draft endpoint - handles autosave for all agent resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.agent.types import (
    PatchAgentDraftApiRequest,
    PatchAgentDraftApiResponse,
)
from app.infra.v4.activity.audit import audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    PatchAgentDraftSqlParams,
    PatchAgentDraftSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/agents/patch_agent_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchAgentDraftApiResponse,
)
async def patch_agent_draft(
    request: PatchAgentDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchAgentDraftApiResponse:
    """Patch agent draft - accepts resource IDs and creates/updates draft."""
    tags = ["agents", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params_payload = {
                "input_draft_id": request.input_draft_id,
                "name_id": request.names.resource_id if request.names else None,
                "description_id": (
                    request.descriptions.resource_id
                    if request.descriptions
                    else None
                ),
                "model_id": request.models.resource_id if request.models else None,
                "prompt_id": request.prompts.resource_id if request.prompts else None,
                "instructions_id": (
                    request.instructions.resource_id
                    if request.instructions
                    else None
                ),
                "active_flag_id": request.flags.resource_id if request.flags else None,
                "temperature_level_id": (
                    request.temperature_levels.resource_id
                    if request.temperature_levels
                    else None
                ),
                "reasoning_level_id": (
                    request.reasoning_levels.resource_id
                    if request.reasoning_levels
                    else None
                ),
                "department_ids": (
                    request.departments.resource_ids if request.departments else None
                ),
                "tool_ids": request.tools.resource_ids if request.tools else None,
                "voice_ids": request.voices.resource_ids if request.voices else None,
                "expected_version": request.expected_version,
            }
            params = PatchAgentDraftSqlParams(
                **params_payload, profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchAgentDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch agent draft")

            audit_set(
                http_request,
                actor={"id": profile_id},
                draft={"id": str(result.draft_id)},
            )

        api_response = PatchAgentDraftApiResponse.model_validate(result.model_dump())

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="patch_agent_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
