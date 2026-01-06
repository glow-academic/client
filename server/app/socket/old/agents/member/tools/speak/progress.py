"""Handler for member_speak_progress - handles incremental DB updates and client emissions."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import load_sql

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_PROGRESS = "app/sql/v4/member/tools/member_tool_progress_update_complete.sql"


class MemberSpeakProgressPayload(BaseModel):
    """Member speak tool progress event."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    chat_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    token: str | None = None
    accumulated_content: str | None = None
    arguments_raw: str
    parent_message_id: str | None = None


class MemberSpeakProgressErrorPayload(BaseModel):
    """Error response for member speak progress."""

    success: bool
    message: str


# Client-facing payload models
class MemberSpeakNewMessagePayload(BaseModel):
    """New member speak message created."""

    message_id: str
    chat_id: str
    role: str
    content: str
    completed: bool
    created_at: str


class MemberSpeakMessageTokenPayload(BaseModel):
    """Token update for member speak message."""

    message_id: str
    chat_id: str
    token: str
    accumulated_content: str


# Client emission functions
async def member_speak_new_message(
    payload: MemberSpeakNewMessagePayload, room: str
) -> None:
    await sio.emit("member_speak_new_message", payload.model_dump(), room=room)


async def member_speak_message_token(
    payload: MemberSpeakMessageTokenPayload, room: str
) -> None:
    await sio.emit("member_speak_message_token", payload.model_dump(), room=room)


async def _member_speak_progress_impl(
    sid: str,
    data: MemberSpeakProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle member_speak_progress - updates DB incrementally and emits to client."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        run_id_uuid = uuid.UUID(data.run_id)
        chat_id_str = data.chat_id
        room = f"member_{chat_id_uuid}"

        async with get_db_connection() as conn:
            if data.type == "tool_call_start":
                # Tool call started - no-op for now, will be handled on first progress
                pass

            elif data.type == "tool_call_progress":
                # Tool call progress - update DB incrementally
                if not data.token or not data.accumulated_content:
                    return

                # Update DB via SQL file
                sql_update = load_sql(SQL_PATH_PROGRESS)
                try:
                    result_row = await conn.fetchrow(
                        sql_update,
                        str(chat_id_uuid),
                        str(run_id_uuid),
                        data.tool_call_id,
                        data.call_id,
                        "speak",  # tool_name
                        data.token,
                        data.accumulated_content,
                        data.arguments_raw,
                        None,  # message_id - will be created/retrieved by SQL
                        uuid.UUID(data.parent_message_id)
                        if data.parent_message_id
                        else None,
                    )

                    if not result_row:
                        return

                    message_id = result_row["message_id"]
                    accumulated_content = result_row["accumulated_content"]

                    # Emit token to client
                    await member_speak_message_token(
                        MemberSpeakMessageTokenPayload(
                            message_id=message_id,
                            chat_id=chat_id_str,
                            token=data.token,
                            accumulated_content=accumulated_content,
                        ),
                        room=room,
                    )

                    # Emit new message event if this is the first token
                    if data.token == accumulated_content[: len(data.token)]:
                        sql_get_created_at = load_sql(
                            "app/sql/v4/messages/get_message_created_at.sql"
                        )
                        message_row = await conn.fetchrow(
                            sql_get_created_at, uuid.UUID(message_id)
                        )
                        created_at = (
                            message_row["created_at"].isoformat()
                            if message_row and message_row.get("created_at")
                            else ""
                        )

                        await member_speak_new_message(
                            MemberSpeakNewMessagePayload(
                                message_id=message_id,
                                chat_id=chat_id_str,
                                role="assistant",
                                content=accumulated_content,
                                completed=False,
                                created_at=created_at,
                            ),
                            room=room,
                        )

                except Exception as e:
                    await internal_sio.emit(
                        "member_speak_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": f"Failed to update progress: {str(e)}",
                        },
                    )

    except Exception as e:
        await internal_sio.emit(
            "member_speak_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@internal_sio.on("member_speak_progress")  # type: ignore
async def member_speak_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_speak_progress event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=MemberSpeakProgressPayload,
        handler=_member_speak_progress_impl,
        error_event_name="member_speak_error",
        error_response_type=MemberSpeakProgressErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/member_speak_progress",
    MemberSpeakProgressPayload,
    "Progress update for Member speak tool",
)
