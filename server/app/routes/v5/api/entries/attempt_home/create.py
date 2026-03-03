"""AttemptHome entry CREATE endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.entries.attempt_home.types import (
    CreateAttemptHomeEntryRequest,
    CreateAttemptHomeEntryResponse,
)
from app.routes.v5.tools.entries.attempt_home.create import (
    SQL_PATH,
    create_attempt_home_entry_internal,
)
from app.sql.types import load_sql_query
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

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
