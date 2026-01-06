"""Handler for hint_error WebSocket event - emits final client error event."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio
from app.sql.types import (HintErrorApiRequest, HintErrorApiResponse,
                           HintErrorSqlParams, HintErrorSqlRow)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/agents/hint_error_complete.sql"


async def _hint_error_impl(
    sid: str,
    data: HintErrorApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - calls SQL function and emits to client."""
    try:
        async with get_db_connection() as conn:
            # Call SQL function using double-star pattern (even if no-op, for consistency)
            params = HintErrorSqlParams(**data.model_dump())
            result = cast(
                HintErrorSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit error to client
            # Client expects chat_id, not resource_id
            response_payload: HintErrorApiResponse = HintErrorApiResponse(
                success=result.success if result else data.success,
                message=result.message if result else data.message,
                resource_id=result.resource_id if result else data.resource_id,  # Client will interpret as chat_id
            )
            await emit_to_client(
                "hints_error",
                response_payload,
                room=sid,
            )
    except Exception as e:
        # If SQL call fails, still emit error to client
        error_response_payload: HintErrorApiResponse = HintErrorApiResponse(
            success=False,
            message=f"Error handling failed: {str(e)}",
            resource_id=data.resource_id,
        )
        await emit_to_client(
            "hints_error",
            error_response_payload,
            room=sid,
        )


@internal_sio.on("hint_error")  # type: ignore
async def hint_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=HintErrorApiRequest,
        handler=_hint_error_impl,  # type: ignore[arg-type]
        error_event_name="hints_error",
        error_response_type=HintErrorApiResponse,
    )


register_server_endpoint(  # type: ignore[arg-type]
    server_router,
    "/hint_error",
    HintErrorApiRequest,
    "Error occurred in hint generation",
)
