"""Test stop entry CREATE endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.entries.test_stop.types import (
    CreateTestStopEntryRequest,
    CreateTestStopEntryResponse,
)
from app.routes.v5.tools.entries.test_stop.create import (
    create_test_stop,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/test-stop/create", response_model=CreateTestStopEntryResponse)
async def create_test_stop_entry(
    request: CreateTestStopEntryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateTestStopEntryResponse:
    """Create test_stop entry."""
    tags = ["entries", "test_stop"]
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

        api_response = await create_test_stop(conn, request_dict, mcp)

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
            operation="create_test_stop_entry",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
