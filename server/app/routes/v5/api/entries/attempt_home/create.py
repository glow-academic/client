"""AttemptHome entry CREATE endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.entries.attempt_home.types import (
    CreateAttemptHomeEntryRequest,
    CreateAttemptHomeEntryResponse,
)
from app.routes.v5.tools.entries.attempt_home.create import create_attempt_home
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.messages.create import create_message
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

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        if not request.run_id:
            raise HTTPException(status_code=400, detail="run_id is required")

        mcp = getattr(http_request.state, "mcp", False) or False
        session_id = getattr(http_request.state, "session_id", None)

        async with conn.transaction():
            call = await create_call(
                conn,
                run_id=request.run_id,
                session_id=session_id or request.run_id,
                mcp=mcp,
            )
            result = await create_attempt_home(
                conn,
                attempt_id=request.attempt_id,
                home_id=request.home_id,
                session_id=session_id or request.run_id,
                mcp=mcp,
            )
            message = await create_message(
                conn, run_id=request.run_id, role="assistant", mcp=mcp
            )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateAttemptHomeEntryResponse(
            id=result.attempt_id, call_id=call.id, message_id=message.id
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_attempt_home_entry",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
