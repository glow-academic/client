"""AttemptContent entry CREATE endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.entries.attempt_content.types import (
    CreateAttemptContentEntryRequest,
    CreateAttemptContentEntryResponse,
    CreateAttemptContentEntrySqlParams,
    CreateAttemptContentEntrySqlRow,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.infra.v4.storage.file_writer import write_text_file
from app.infra.v4.tools.call_args import resolve_tool_for_entry
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_content/create_attempt_content_entries_complete.sql"

ENTRY_TYPE = "contents"

router = APIRouter()


async def create_attempt_content_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
    run_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> CreateAttemptContentEntryResponse:
    """Internal function to create attempt_content entry.

    Internal callers can pass run_id and tool_id directly.
    If not provided, tool is resolved from settings via operation + entry type.
    """
    tags = ["entries", "attempt_content"]

    # Resolve tool if not provided
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            tool_id = tool_info.tool_id

    async with conn.transaction():
        request_dict["mcp"] = mcp
        request_dict["upload_id"] = await write_text_file(
            conn, None, "Created attempt content entry"
        )
        request_dict["tool_id"] = tool_id
        if run_id is not None:
            request_dict["run_id"] = run_id

        params = CreateAttemptContentEntrySqlParams(**request_dict)

        result = cast(
            CreateAttemptContentEntrySqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.entry_id:
            raise ValueError("Failed to create attempt_content entry")

    await invalidate_tags(tags)

    return CreateAttemptContentEntryResponse(
        id=result.entry_id,
        call_id=result.entry_call_id,
        message_id=result.entry_message_id,
    )


@router.post(
    "/attempt-content/create", response_model=CreateAttemptContentEntryResponse
)
async def create_attempt_content_entry(
    request: CreateAttemptContentEntryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAttemptContentEntryResponse:
    """Create attempt_content entry."""
    tags = ["entries", "attempt_content"]
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

        api_response = await create_attempt_content_entry_internal(
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
            operation="create_attempt_content_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
