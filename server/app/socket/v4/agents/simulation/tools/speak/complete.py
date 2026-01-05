"""Handler for simulation_speak_complete - finalizes DB and emits to client."""

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

SQL_PATH_FINALIZE = (
    "app/sql/v4/simulation/tools/simulation_tool_complete_finalize_complete.sql"
)


class SimulationSpeakCompletePayload(BaseModel):
    """Simulation speak tool complete event."""

    sid: str
    chat_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    final_message: str
    final_persona: str | None = None
    arguments_raw: str


class SimulationSpeakCompleteErrorPayload(BaseModel):
    """Error response for simulation speak complete."""

    success: bool
    message: str


# Client-facing payload models
class SimulationMessageCompletePayload(BaseModel):
    """Simulation message completed."""

    message_id: str
    chat_id: str
    final_content: str


class SimulationNewMessagePayload(BaseModel):
    """Simulation message update."""

    message_id: str
    chat_id: str
    role: str
    content: str
    completed: bool
    created_at: str
    persona_id: str | None = None


# Client emission functions
async def simulation_message_complete(
    payload: SimulationMessageCompletePayload, room: str
) -> None:
    await sio.emit("simulations_text_message_complete", payload.model_dump(), room=room)


async def simulation_new_message(
    payload: SimulationNewMessagePayload, room: str
) -> None:
    await sio.emit("simulations_text_new_message", payload.model_dump(), room=room)


async def _simulation_speak_complete_impl(
    sid: str,
    data: SimulationSpeakCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle simulation_speak_complete - finalizes DB and emits to client."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        run_id_uuid = uuid.UUID(data.run_id)
        chat_id_str = data.chat_id
        room = f"simulation_{chat_id_uuid}"

        async with get_db_connection() as conn:
            # Resolve persona_id if final_persona provided
            persona_id_uuid = None
            if data.final_persona:
                sql_get_personas = load_sql("app/sql/v4/voice/get_chat_personas.sql")
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
                        if persona_name_lower in p_name or p_name in persona_name_lower:
                            return (
                                uuid.UUID(persona["persona_id"]),
                                persona.get("persona_name") or persona.get("name", ""),
                            )
                    return None

                persona_match = find_persona_by_name_inline(
                    data.final_persona, personas
                )
                if persona_match:
                    persona_id_uuid = persona_match[0]

            # Get message_id from tool_call
            message_id_uuid = None
            if data.tool_call_id:
                sql_get_message = load_sql(
                    "app/sql/v4/simulations/get_message_id_from_tool_call_complete.sql"
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
                        "app/sql/v4/simulations/get_message_id_from_tool_call_complete.sql"
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
                uuid.UUID(data.tool_call_id) if data.tool_call_id else None,
                data.call_id,
                message_id_uuid,
                data.final_message,
                persona_id_uuid,
            )

            if not result_row:
                return

            final_message_id = result_row["message_id"]
            final_content = result_row["final_content"]
            completed = result_row["completed"]

            # Emit completion to client
            await simulation_message_complete(
                SimulationMessageCompletePayload(
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

            await simulation_new_message(
                SimulationNewMessagePayload(
                    message_id=final_message_id,
                    chat_id=chat_id_str,
                    role="assistant",
                    content=final_content,
                    completed=completed,
                    created_at=created_at,
                    persona_id=str(persona_id_uuid) if persona_id_uuid else None,
                ),
                room=room,
            )

    except Exception as e:
        await internal_sio.emit(
            "simulation_speak_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Failed to finalize: {str(e)}",
            },
        )


@internal_sio.on("simulation_speak_complete")  # type: ignore
async def simulation_speak_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_speak_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=SimulationSpeakCompletePayload,
        handler=_simulation_speak_complete_impl,
        error_event_name="simulation_speak_error",
        error_response_type=SimulationSpeakCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/simulation_speak_complete",
    SimulationSpeakCompletePayload,
    "Simulation speak tool completed successfully",
)
