"""AttemptImprovement entry CREATE endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.entries.attempt_improvement.types import (
    CreateAttemptImprovementEntryRequest,
    CreateAttemptImprovementEntryResponse,
    CreateAttemptImprovementEntrySqlParams,
    CreateAttemptImprovementEntrySqlRow,
)
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.storage.file_writer import write_text_file
from app.v5.infra.tools.call_args import resolve_tool_for_entry
from app.v5.infra.globals import get_db
from app.v5.sql.types import load_sql_query
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/attempt_improvement/create_attempt_improvement_entries_complete.sql"

ENTRY_TYPE = "improvements"

router = APIRouter()


async def create_attempt_improvement_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
    run_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> CreateAttemptImprovementEntryResponse:
    """Internal function to create attempt_improvement entry.

    Internal callers can pass run_id and tool_id directly.
    If not provided, tool is resolved from settings via operation + entry type.
    """
    tags = ["entries", "attempt_improvement"]

    # Resolve tool if not provided
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            tool_id = tool_info.tool_id

    async with conn.transaction():
        request_dict["mcp"] = mcp
        request_dict["upload_id"] = await write_text_file(
            conn, None, "Created attempt improvement entry"
        )
        request_dict["tool_id"] = tool_id
        if run_id is not None:
            request_dict["run_id"] = run_id

        params = CreateAttemptImprovementEntrySqlParams(**request_dict)

        result = cast(
            CreateAttemptImprovementEntrySqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.entry_id:
            raise ValueError("Failed to create attempt_improvement entry")

    await invalidate_tags(tags)

    return CreateAttemptImprovementEntryResponse(
        id=result.entry_id,
        call_id=result.entry_call_id,
        message_id=result.entry_message_id,
    )


@router.post(
    "/attempt-improvement/create", response_model=CreateAttemptImprovementEntryResponse
)
async def create_attempt_improvement_entry(
    request: CreateAttemptImprovementEntryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAttemptImprovementEntryResponse:
    """Create attempt_improvement entry."""
    tags = ["entries", "attempt_improvement"]
    sql_query = load_sql_query(SQL_PATH)

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        mcp = getattr(http_request.state, "mcp", False) or False
        request_dict = request.model_dump()

        # API caller does not pass run_id — resolved internally
        if "run_id" not in request_dict or request_dict.get("run_id") is None:
            raise HTTPException(
                status_code=400,
                detail="run_id is required",
            )

        api_response = await create_attempt_improvement_entry_internal(
            conn, request_dict, mcp
        )

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
            operation="create_attempt_improvement_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
