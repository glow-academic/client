"""Test feedback entry CREATE endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.entries.test_feedback.types import (
    CreateTestFeedbackEntryRequest,
    CreateTestFeedbackEntryResponse,
    CreateTestFeedbackEntrySqlParams,
    CreateTestFeedbackEntrySqlRow,
)
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.storage.file_writer import write_text_file
from app.v5.infra.tools.call_args import record_call_args, resolve_tool_for_entry
from app.v5.infra.globals import get_db
from app.v5.sql.types import load_sql_query
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/v5/sql/queries/entries/test_feedback/create_test_feedback_entries_complete.sql"
)

ENTRY_TYPE = "test_feedbacks"

router = APIRouter()


async def create_test_feedback_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
    run_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> CreateTestFeedbackEntryResponse:
    """Internal function to create test_feedback entry.

    Internal callers can pass run_id and tool_id directly.
    If not provided, tool is resolved from settings via operation + entry type.
    """
    tags = ["entries", "test_feedback"]

    # Resolve tool if not provided
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            tool_id = tool_info.tool_id

    async with conn.transaction():
        request_dict["mcp"] = mcp
        request_dict["upload_id"] = await write_text_file(
            conn, None, "Created test feedback entry"
        )
        request_dict["tool_id"] = tool_id
        if run_id is not None:
            request_dict["run_id"] = run_id

        params = CreateTestFeedbackEntrySqlParams(**request_dict)

        result = cast(
            CreateTestFeedbackEntrySqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create test_feedback entry")

        # Record arg values via connection pattern
        if tool_info is None and tool_id is not None:
            tool_info = await resolve_tool_for_entry(conn, "create", ENTRY_TYPE)
        if tool_info:
            await record_call_args(conn, result.call_id, tool_info, request_dict, mcp)

    await invalidate_tags(tags)

    return CreateTestFeedbackEntryResponse.model_validate(result.model_dump())


@router.post("/test-feedback/create", response_model=CreateTestFeedbackEntryResponse)
async def create_test_feedback_entry(
    request: CreateTestFeedbackEntryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateTestFeedbackEntryResponse:
    """Create test_feedback entry."""
    tags = ["entries", "test_feedback"]
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

        api_response = await create_test_feedback_entry_internal(
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
            operation="create_test_feedback_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
