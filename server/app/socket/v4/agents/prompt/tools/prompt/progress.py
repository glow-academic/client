"""Handler for prompt_prompt_progress - handles incremental DB updates and client emissions."""

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

SQL_PATH_PROGRESS = "app/sql/v4/prompt/tools/member_tool_progress_update_complete.sql"


class PromptPromptProgressPayload(BaseModel):
    """Member prompt tool progress event."""

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


class PromptPromptProgressErrorPayload(BaseModel):
    """Error response for member prompt progress."""

    success: bool
    message: str


# Client-facing payload models
class PromptPromptNewMessagePayload(BaseModel):
    """New member prompt message created."""

    message_id: str
    chat_id: str
    role: str
    content: str
    completed: bool
    created_at: str


class PromptPromptMessageTokenPayload(BaseModel):
    """Token update for member prompt message."""

    message_id: str
    chat_id: str
    token: str
    accumulated_content: str


# Client emission functions
async def prompt_prompt_new_message(
    payload: PromptPromptNewMessagePayload, room: str
) -> None:
    await sio.emit("prompt_prompt_new_message", payload.model_dump(), room=room)


async def prompt_prompt_message_token(
    payload: PromptPromptMessageTokenPayload, room: str
) -> None:
    await sio.emit("prompt_prompt_message_token", payload.model_dump(), room=room)


async def _prompt_prompt_progress_impl(
    sid: str,
    data: PromptPromptProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle prompt_prompt_progress - updates DB incrementally and emits to client."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        run_id_uuid = uuid.UUID(data.run_id)
        chat_id_str = data.chat_id
        room = f"prompt_{chat_id_uuid}"

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
                        "create_prompt",  # tool_name
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
                    await prompt_prompt_message_token(
                        PromptPromptMessageTokenPayload(
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

                        await prompt_prompt_new_message(
                            PromptPromptNewMessagePayload(
                                message_id=message_id,
                                chat_id=chat_id_str,
                                role="system",
                                content=accumulated_content,
                                completed=False,
                                created_at=created_at,
                            ),
                            room=room,
                        )

                except Exception as e:
                    await internal_sio.emit(
                        "prompt_prompt_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": f"Failed to update progress: {str(e)}",
                        },
                    )

    except Exception as e:
        await internal_sio.emit(
            "prompt_prompt_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@internal_sio.on("prompt_prompt_progress")  # type: ignore
async def prompt_prompt_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle prompt_prompt_progress event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=PromptPromptProgressPayload,
        handler=_prompt_prompt_progress_impl,
        error_event_name="prompt_prompt_error",
        error_response_type=PromptPromptProgressErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/prompt_prompt_progress",
    PromptPromptProgressPayload,
    "Progress update for Member prompt tool",
)
