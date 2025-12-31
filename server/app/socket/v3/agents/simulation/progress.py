"""Handler for simulation_text_progress internal event - updates DB incrementally and emits to client."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
# Note: SQL types will be imported after SQL files are converted to functions
# from app.sql.types import (
#     TextProgressUpdateSqlParams,
#     TextProgressUpdateSqlRow,
#     GetMessageCreatedAtSqlParams,
#     GetMessageCreatedAtSqlRow,
# )

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for internal events
class SimulationTextProgressPayload(BaseModel):
    """Internal event for simulation text progress updates."""

    sid: str
    type: str  # "tool_call_start" | "message_token"
    chat_id: str
    run_id: str
    tool_call_id: str | None = None
    call_id: str | None = None
    tool_name: str | None = None
    token: str | None = None
    accumulated_content: str | None = None
    arguments_raw: str | None = None
    persona_so_far: str | None = None
    parent_message_id: str | None = None


class SimulationTextProgressErrorPayload(BaseModel):
    """Response indicating an error occurred in simulation text progress."""

    success: bool
    message: str


# Client-facing payload models
class SimulationNewMessagePayload(BaseModel):
    """Response indicating a new simulation message was created."""

    message_id: str
    chat_id: str
    role: str
    content: str
    completed: bool
    created_at: str
    persona_id: str | None = None


class SimulationMessageTokenPayload(BaseModel):
    """Response indicating a token was received for a simulation message."""

    message_id: str
    chat_id: str
    token: str
    accumulated_content: str


# Client emission functions
async def simulation_new_message(
    payload: SimulationNewMessagePayload, room: str
) -> None:
    await sio.emit("simulations_text_new_message", payload.model_dump(), room=room)


async def simulation_message_token(
    payload: SimulationMessageTokenPayload, room: str
) -> None:
    await sio.emit("simulations_text_message_token", payload.model_dump(), room=room)


async def _simulation_text_progress_impl(
    sid: str,
    data: SimulationTextProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle simulation_text_progress internal event - updates DB and emits to client."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        run_id_uuid = uuid.UUID(data.run_id)
        chat_id_str = data.chat_id
        room = f"simulation_{chat_id_uuid}"
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            if data.type == "tool_call_start":
                # Tool call started - create tool call and initial message
                # This will be handled by the SQL file when message_token is received
                pass
            elif data.type == "message_token":
                # Message token received - update DB incrementally
                if not data.token or not data.accumulated_content:
                    return

                # Resolve persona_id if persona_so_far provided
                persona_id_uuid = None
                if data.persona_so_far:
                    # Note: get_chat_personas.sql is a simple query - keep as is for now
                    from utils.sql_helper import load_sql

                    sql_get_personas = load_sql(
                        "app/sql/v3/voice/get_chat_personas.sql"
                    )
                    persona_rows = await conn.fetch(sql_get_personas, chat_id_str)
                    personas = [dict(row) for row in persona_rows]

                    def find_persona_by_name_inline(
                        persona_name: str, personas_list: list[dict[str, Any]]
                    ) -> tuple[uuid.UUID, str] | None:
                        persona_name_lower = persona_name.lower().strip()
                        for persona in personas_list:
                            p_name = (
                                persona.get("persona_name") or persona.get("name", "")
                            ).lower()
                            if (
                                persona_name_lower in p_name
                                or p_name in persona_name_lower
                            ):
                                return (
                                    uuid.UUID(persona["persona_id"]),
                                    persona.get("persona_name")
                                    or persona.get("name", ""),
                                )
                        return None

                    persona_match = find_persona_by_name_inline(
                        data.persona_so_far, personas
                    )
                    if persona_match:
                        persona_id_uuid = persona_match[0]

                # Update DB via consolidated SQL file
                # Note: text_progress_update_complete.sql needs to be converted to function
                # For now, using load_sql() - will convert to execute_sql_typed() after SQL conversion
                from utils.sql_helper import load_sql

                sql_update = load_sql(
                    "app/sql/v3/simulation_text_text_progress_update_complete.sql"
                )
                try:
                    result_row = await conn.fetchrow(
                        sql_update,
                        str(chat_id_uuid),
                        str(run_id_uuid),
                        data.tool_call_id,
                        data.call_id,
                        data.tool_name,
                        data.token,
                        data.accumulated_content,
                        data.arguments_raw,
                        None,  # message_id - will be created_retrieved by SQL
                        uuid.UUID(data.parent_message_id)
                        if data.parent_message_id
                        else None,
                        persona_id_uuid,
                    )

                    if not result_row:
                        return

                    message_id = result_row["message_id"]
                    tool_call_id = result_row.get("tool_call_id")
                    accumulated_content = result_row["accumulated_content"]

                    # Emit token to client
                    await simulation_message_token(
                        SimulationMessageTokenPayload(
                            message_id=message_id,
                            chat_id=chat_id_str,
                            token=data.token,
                            accumulated_content=accumulated_content,
                        ),
                        room=room,
                    )

                    # Emit new message event if this is the first token (message just created)
                    if data.token == accumulated_content[: len(data.token)]:
                        # Note: get_message_created_at.sql is a simple query - keep as is for now
                        sql_get_created_at = load_sql(
                            "app/sql/v3/messages/get_message_created_at.sql"
                        )
                        message_row = await conn.fetchrow(
                            sql_get_created_at, uuid.UUID(message_id)
                        )
                        created_at = (
                            message_row["created_at"].isoformat()
                            if message_row and message_row.get("created_at")
                            else ""
                        )

                        await simulation_new_message(
                            SimulationNewMessagePayload(
                                message_id=message_id,
                                chat_id=chat_id_str,
                                role="assistant",
                                content=accumulated_content,
                                completed=False,
                                created_at=created_at,
                                persona_id=str(persona_id_uuid)
                                if persona_id_uuid
                                else None,
                            ),
                            room=room,
                        )

                except Exception as e:
                    await internal_sio.emit(
                        "simulation_text_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": f"Failed to update progress: {str(e)}",
                        },
                    )

    except Exception as e:
        await internal_sio.emit(
            "simulation_text_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@internal_sio.on("simulation_text_progress")  # type: ignore
async def simulation_text_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_text_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SimulationTextProgressPayload,
        handler=_simulation_text_progress_impl,  # type: ignore[arg-type]
        error_event_name="simulation_text_error",
        error_response_type=SimulationTextProgressErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/simulation_text_progress",
    SimulationTextProgressPayload,
    "Progress update for Simulation Text generation",
)
