"""Handler for prompt_prompt_complete - finalizes DB and emits to client."""

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

SQL_PATH_FINALIZE = "app/sql/v4/prompt/tools/prompt_tool_complete_finalize_complete.sql"


class PromptPromptCompletePayload(BaseModel):
    """Member prompt tool complete event."""

    sid: str
    chat_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    final_content: str
    arguments_raw: str


class PromptPromptCompleteErrorPayload(BaseModel):
    """Error response for member prompt complete."""

    success: bool
    message: str


# Client-facing payload models
class PromptPromptMessageCompletePayload(BaseModel):
    """Member prompt message completed."""

    message_id: str
    chat_id: str
    final_content: str


class PromptPromptNewMessagePayload(BaseModel):
    """Member prompt message update."""

    message_id: str
    chat_id: str
    role: str
    content: str
    completed: bool
    created_at: str


# Client emission functions
async def prompt_prompt_message_complete(
    payload: PromptPromptMessageCompletePayload, room: str
) -> None:
    await sio.emit("prompt_prompt_message_complete", payload.model_dump(), room=room)


async def prompt_prompt_new_message(
    payload: PromptPromptNewMessagePayload, room: str
) -> None:
    await sio.emit("prompt_prompt_new_message", payload.model_dump(), room=room)


async def _prompt_prompt_complete_impl(
    sid: str,
    data: PromptPromptCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle prompt_prompt_complete - finalizes DB and emits to client."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        run_id_uuid = uuid.UUID(data.run_id)
        chat_id_str = data.chat_id
        room = f"prompt_{chat_id_uuid}"

        async with get_db_connection() as conn:
            # Get message_id from tool_call
            message_id_uuid = None
            if data.tool_call_id:
                sql_get_message = load_sql(
                    "app/sql/v4/simulations/get_message_id_from_tool_call.sql"
                )
                message_row = await conn.fetchrow(
                    sql_get_message,
                    uuid.UUID(data.tool_call_id),
                    str(run_id_uuid),
                )
                if message_row:
                    message_id_uuid = message_row["message_id"]
            elif data.call_id:
                sql_get_tool_call = load_sql(
                    "app/sql/v4/calls/get_tool_call_by_call_id_complete.sql"
                )
                tool_call_row = await conn.fetchrow(sql_get_tool_call, data.call_id)
                if tool_call_row:
                    sql_get_message = load_sql(
                        "app/sql/v4/simulations/get_message_id_from_tool_call.sql"
                    )
                    message_row = await conn.fetchrow(
                        sql_get_message,
                        tool_call_row["id"],
                        str(run_id_uuid),
                    )
                    if message_row:
                        message_id_uuid = message_row["message_id"]

            if not message_id_uuid:
                return

            # Finalize via SQL file
            sql_finalize = load_sql(SQL_PATH_FINALIZE)
            result_row = await conn.fetchrow(
                sql_finalize,
                str(chat_id_uuid),
                str(run_id_uuid),
                data.tool_call_id,
                data.call_id,
                message_id_uuid,
                data.final_content,
            )

            if not result_row:
                return

            final_message_id = result_row["message_id"]
            final_content = result_row["final_content"]
            completed = result_row["completed"]

            # Emit completion to client
            await prompt_prompt_message_complete(
                PromptPromptMessageCompletePayload(
                    message_id=final_message_id,
                    chat_id=chat_id_str,
                    final_content=final_content,
                ),
                room=room,
            )

            # Emit final message update
            sql_get_created_at = load_sql(
                "app/sql/v4/messages/get_message_created_at.sql"
            )
            message_row = await conn.fetchrow(
                sql_get_created_at, uuid.UUID(final_message_id)
            )
            created_at = (
                message_row["created_at"].isoformat()
                if message_row and message_row.get("created_at")
                else ""
            )

            await prompt_prompt_new_message(
                PromptPromptNewMessagePayload(
                    message_id=final_message_id,
                    chat_id=chat_id_str,
                    role="system",
                    content=final_content,
                    completed=completed,
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
                "message": f"Failed to finalize: {str(e)}",
            },
        )


@internal_sio.on("prompt_prompt_complete")  # type: ignore
async def prompt_prompt_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle prompt_prompt_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=PromptPromptCompletePayload,
        handler=_prompt_prompt_complete_impl,
        error_event_name="prompt_prompt_error",
        error_response_type=PromptPromptCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/prompt_prompt_complete",
    PromptPromptCompletePayload,
    "Member prompt tool completed successfully",
)
