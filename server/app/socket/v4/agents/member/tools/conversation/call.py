"""Handler for conversation_end WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class ConversationEndToolPayload(BaseModel):
    """Request to end a conversation."""

    chat_id: str
    trace_id: str
    profile_id: str | None = None
    sid: str | None = None


class ConversationEndToolCompletePayload(BaseModel):
    """Response indicating conversation_end tool completed successfully."""

    success: bool
    chat_id: str
    trace_id: str
    message: str | None = None


class ConversationEndToolErrorPayload(BaseModel):
    """Response indicating an error occurred in conversation_end tool."""

    success: bool
    chat_id: str
    trace_id: str
    message: str


async def conversation_end_tool_complete(
    payload: ConversationEndToolCompletePayload, room: str
) -> None:
    await sio.emit("conversation_end_complete", payload.model_dump(), room=room)


async def conversation_end_tool_error(
    payload: ConversationEndToolErrorPayload, room: str
) -> None:
    await sio.emit("conversation_end_error", payload.model_dump(), room=room)


async def _conversation_end_impl(sid: str, data: dict[str, Any]) -> str | None:
    """Internal implementation for ending a conversation."""

    try:
        validated = ConversationEndToolPayload(**data)
    except ValidationError as e:
        await conversation_end_tool_error(
            ConversationEndToolErrorPayload(
                success=False,
                chat_id=data.get("chat_id", "unknown"),
                trace_id=data.get("trace_id", "unknown"),
                message=f"Invalid payload: {str(e)}",
            ),
            room=f"simulation_{data.get('chat_id', 'unknown')}",
        )
        return None

    chat_id = validated.chat_id
    trace_id = validated.trace_id
    # Replaced with get_db_connection() None

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with get_db_connection() as conn:
            # Mark conversation as ended
            # This is a placeholder - actual implementation will mark chat as completed
            # Emit complete event
            await internal_sio.emit(
                "conversation_end_complete",
                {
                    "sid": sid,
                    "success": True,
                    "chat_id": chat_id,
                    "trace_id": trace_id,
                    "message": "Conversation ended successfully",
                },
            )

            return "success"

    except Exception as e:
        await conversation_end_tool_error(
            ConversationEndToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=f"Internal error: {str(e)}",
            ),
            room=f"simulation_{chat_id}",
        )
        return None


async def conversation_end(sid: str, data: dict[str, Any]) -> None:
    """Handle conversation_end event from client."""
    await _conversation_end_impl(sid, data)


@internal_sio.on("conversation_end")  # type: ignore
async def conversation_end_internal(data: dict[str, Any]) -> None:
    """Handle conversation_end event from internal bus (server-to-server)."""
    sid = data.get("sid", "")
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _conversation_end_impl(sid, payload)


from app.infra.v4.websocket.openapi_helpers import register_server_endpoint

register_server_endpoint(
    server_router,
    "/conversation_end",
    ConversationEndToolPayload,
    "Conversation end tool handler",
)
