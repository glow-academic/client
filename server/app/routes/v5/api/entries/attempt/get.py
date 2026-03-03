"""Attempt entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt.get import (
    SQL_PATH,
    get_attempt_entries_internal,
)
from app.sql.types import (
    GetAttemptEntriesApiRequest,
    GetAttemptEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# ---------------------------------------------------------------------------
# Types (inlined from types.py)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Training config helper
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Internal: get attempt entries
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Internal: get attempt chats
# ---------------------------------------------------------------------------

CHATS_SQL_PATH = None  # Uses get_chats_internal, no direct SQL

# ---------------------------------------------------------------------------
# Internal: get attempt messages
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Router handler
# ---------------------------------------------------------------------------

@router.post(
    "/attempt/get",
    response_model=GetAttemptEntriesApiResponse,
)
async def get_attempt_entries(
    request: GetAttemptEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptEntriesApiResponse:
    """Get attempt entries by IDs."""
    tags = ["entries", "attempt"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
