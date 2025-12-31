"""Handler for conversation_end WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
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
    logger.info(
        f"[conversation_end_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, chat_id={payload.chat_id}"
    )
    await sio.emit("conversation_end_complete", payload.model_dump(), room=room)
    logger.info(f"[conversation_end_complete] Emitted to room={room}")


async def conversation_end_tool_error(
    payload: ConversationEndToolErrorPayload, room: str
) -> None:
    await sio.emit("conversation_end_error", payload.model_dump(), room=room)


async def _conversation_end_impl(sid: str, data: dict[str, Any]) -> str | None:
    """Internal implementation for ending a conversation."""
    logger.info(
        f"[conversation_end] Handler received event: sid={sid}, "
        f"chat_id={data.get('chat_id', 'unknown')}, trace_id={data.get('trace_id', 'unknown')}"
    )

    try:
        validated = ConversationEndToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in conversation_end for {sid}: {e}")
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
    pool = get_pool()

    if not pool:
        await conversation_end_tool_error(
            ConversationEndToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message="Database connection pool not available",
            ),
            room=f"simulation_{chat_id}",
        )
        return None

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            # Mark conversation as ended
            # This is a placeholder - actual implementation will mark chat as completed
            logger.info(f"[conversation_end] Ending conversation for chat {chat_id}")

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
        logger.error(f"Error in conversation_end for {sid}: {str(e)}", exc_info=True)
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


from app.infra.v3.websocket.openapi_helpers import register_server_endpoint

register_server_endpoint(
    server_router,
    "/conversation_end",
    ConversationEndToolPayload,
    "Conversation end tool handler",
)

