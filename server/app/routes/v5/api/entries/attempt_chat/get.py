"""Attempt Chat entry GET endpoint.

Contains two get functions:
- get_attempt_chat_entries_internal: Entry-level get by IDs from attempt_chat_entries MV
- get_chats_internal: Views-layer analytics query from attempt_chat_mv with filtering
"""

from datetime import date
from typing import Annotated
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_chat.get import (
    SQL_PATH,
    get_attempt_chat_entries_internal,
)
from app.sql.types import (
    GetAttemptChatEntriesApiRequest,
    GetAttemptChatEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# ---------------------------------------------------------------------------
# Types for get_chats_internal (views-layer analytics from attempt_chat_mv)
# ---------------------------------------------------------------------------


class GetChatsRequest(BaseModel):
    """Request for getting chats with filters and pagination."""

    # Filters
    profile_id: UUID | None = Field(default=None, description="Filter by profile ID")
    cohort_ids: list[UUID] | None = Field(
        default=None, description="Filter by cohort IDs"
    )
    department_ids: list[UUID] | None = Field(
        default=None, description="Filter by department IDs"
    )
    simulation_ids: list[UUID] | None = Field(
        default=None, description="Filter by simulation IDs"
    )
    scenario_ids: list[UUID] | None = Field(
        default=None, description="Filter by scenario IDs"
    )
    rubric_ids: list[UUID] | None = Field(
        default=None, description="Filter by rubric IDs"
    )
    attempt_id: UUID | None = Field(default=None, description="Filter by attempt ID")
    attempt_type: str | None = Field(
        default=None, description="Filter by attempt type: 'general' | 'practice'"
    )
    is_archived: bool = Field(default=False, description="Include archived attempts")
    date_from: date | None = Field(
        default=None, description="Filter by date range start (inclusive)"
    )
    date_to: date | None = Field(
        default=None, description="Filter by date range end (inclusive)"
    )

    # Sorting
    sort_by: str = Field(
        default="date", description="Sort field: 'date' | 'created_at'"
    )
    sort_order: str = Field(default="desc", description="Sort order: 'asc' | 'desc'")

    # Pagination
    page_limit: int = Field(default=10000, description="Items per page", ge=1, le=50000)
    page_offset: int = Field(default=0, description="Pagination offset", ge=0)


@router.post(
    "/attempt_chat/get",
    response_model=GetAttemptChatEntriesApiResponse,
)
async def get_attempt_chat_entries(
    request: GetAttemptChatEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptChatEntriesApiResponse:
    """Get attempt_chat entries by IDs."""
    tags = ["entries", "attempt_chat"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_chat_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptChatEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_chat_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )


# ---------------------------------------------------------------------------
# Views-layer: get_chats_internal (analytics query from attempt_chat_mv)
# ---------------------------------------------------------------------------
