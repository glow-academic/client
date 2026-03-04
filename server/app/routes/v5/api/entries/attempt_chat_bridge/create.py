"""AttemptChatBridge entry CREATE endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_chat_bridge.create import (
    create_attempt_chat_bridge,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.messages.create import create_message
from app.sql.types import (
    CreateAttemptChatBridgeEntriesApiRequest,
    CreateAttemptChatBridgeEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt-chat-bridge/create",
    response_model=CreateAttemptChatBridgeEntriesApiResponse,
)
async def create_attempt_chat_bridge_entry(
    request: CreateAttemptChatBridgeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAttemptChatBridgeEntriesApiResponse:
    """Create attempt_chat_bridge entry."""
    tags = ["entries", "attempt_chat_bridge"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        mcp = getattr(http_request.state, "mcp", False) or False
        session_id = getattr(http_request.state, "session_id", None)
        run_id = getattr(request, "run_id", None)

        async with conn.transaction():
            call = await create_call(
                conn,
                run_id=run_id or request.attempt_id,
                session_id=session_id or request.attempt_id,
                mcp=mcp,
            )
            result = await create_attempt_chat_bridge(
                conn,
                attempt_id=request.attempt_id,
                attempt_chat_id=request.attempt_chat_id,
                session_id=session_id or request.attempt_id,
                mcp=mcp,
            )
            message = await create_message(
                conn,
                run_id=run_id or request.attempt_id,
                role="assistant",
                mcp=mcp,
            )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateAttemptChatBridgeEntriesApiResponse(
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
            operation="create_attempt_chat_bridge_entry",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
