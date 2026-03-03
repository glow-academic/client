"""AttemptHome entry CREATE endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.entries.attempt_home.types import (
    CreateAttemptHomeEntryRequest,
    CreateAttemptHomeEntryResponse,
    CreateAttemptHomeEntrySqlParams,
    CreateAttemptHomeEntrySqlRow,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.storage.file_writer import write_text_file
from app.infra.tools.call_args import record_call_args, resolve_tool_for_entry
from app.globals import get_db
from app.sql.types import load_sql_query
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/entries/attempt_home/create_attempt_home_entries_complete.sql"
)

ENTRY_TYPE = "attempt_homes"

router = APIRouter()


async def create_attempt_home_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
    run_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> CreateAttemptHomeEntryResponse:
    """Internal function to create attempt_home bridge entry."""
    tags = ["entries", "attempt_home"]

    # Resolve tool if not provided
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            tool_id = tool_info.tool_id

    async with conn.transaction():
        request_dict["mcp"] = mcp
        request_dict["upload_id"] = await write_text_file(
            conn, None, "Created attempt home entry"
        )
        request_dict["tool_id"] = tool_id
        if run_id is not None:
            request_dict["run_id"] = run_id

        params = CreateAttemptHomeEntrySqlParams(**request_dict)

        result = cast(
            CreateAttemptHomeEntrySqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create attempt_home entry")

        # Record arg values via connection pattern
        if tool_info is None and tool_id is not None:
            tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            await record_call_args(conn, result.call_id, tool_info, request_dict, mcp)

    await invalidate_tags(tags)

    return CreateAttemptHomeEntryResponse.model_validate(result.model_dump())


@router.post("/attempt-home/create", response_model=CreateAttemptHomeEntryResponse)
async def create_attempt_home_entry(
    request: CreateAttemptHomeEntryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAttemptHomeEntryResponse:
    """Create attempt_home bridge entry."""
    tags = ["entries", "attempt_home"]
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

        if "run_id" not in request_dict or request_dict.get("run_id") is None:
            raise HTTPException(
                status_code=400,
                detail="run_id is required",
            )

        api_response = await create_attempt_home_entry_internal(conn, request_dict, mcp)

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
            operation="create_attempt_home_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
