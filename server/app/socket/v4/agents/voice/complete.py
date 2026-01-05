"""Handler for simulation_voice_complete WebSocket event - finalizes messages and runs."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import (
    handle_client_event,
    handle_internal_event,
)
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class SimulationVoiceCompletePayload(BaseModel):
    """Request to finalize voice simulation."""

    chat_id: str
    run_id: str | None = None


class SimulationVoiceCompleteResponsePayload(BaseModel):
    """Response indicating Simulation Voice generation completed successfully."""

    success: bool
    message: str | None = None


class SimulationVoiceErrorPayload(BaseModel):
    """Response indicating an error occurred in Simulation Voice generation."""

    success: bool
    message: str


async def _simulation_voice_complete_impl(
    sid: str,
    data: SimulationVoiceCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle simulation_voice_complete event - finalizes messages and runs."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        chat_id_str = data.chat_id

        async with get_db_connection() as conn:
            # Get run_id if not provided
            run_id_uuid = None
            if data.run_id:
                run_id_uuid = uuid.UUID(data.run_id)
            else:
                sql_get_latest_run = load_sql(
                    "app/sql/v4/simulations/get_latest_run_for_chat.sql"
                )
                latest_run_row = await conn.fetchrow(
                    sql_get_latest_run, str(chat_id_uuid)
                )
                if latest_run_row:
                    run_id_uuid = latest_run_row["run_id"]

            if not run_id_uuid:
                await emit_to_client(
                    "simulations_voice_complete",
                    SimulationVoiceCompleteResponsePayload(
                        success=False, message="No run found for chat"
                    ),
                    room=sid,
                )
                return

            # Finalize via SQL using execute_sql_typed()
            try:
                from app.sql.types import (
                    VoiceCompleteV3SqlParams,
                    VoiceCompleteV3SqlRow,
                )

                SQL_PATH = "app/sql/v4/simulation_voice/voice_complete_complete.sql"
                params = VoiceCompleteV3SqlParams(
                    chat_id=chat_id_uuid,
                    run_id=run_id_uuid,
                )
                result = cast(
                    VoiceCompleteV3SqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )

                if result and result.success:
                    messages_finalized = result.messages_finalized or "0"
                    await emit_to_client(
                        "simulations_voice_complete",
                        SimulationVoiceCompleteResponsePayload(
                            success=True,
                            message=f"Finalized {messages_finalized} messages",
                        ),
                        room=sid,
                    )
                else:
                    await emit_to_client(
                        "simulations_voice_complete",
                        SimulationVoiceCompleteResponsePayload(
                            success=False, message="Failed to finalize simulation"
                        ),
                        room=sid,
                    )
            except ImportError:
                # Fallback to load_sql if types not generated yet
                sql_finalize = load_sql(
                    "app/sql/v4/simulation_voice/voice_complete_complete.sql"
                )
                result_row = await conn.fetchrow(
                    sql_finalize, str(chat_id_uuid), str(run_id_uuid)
                )

                if result_row and result_row.get("success"):
                    messages_finalized = result_row.get("messages_finalized", "0")
                    await emit_to_client(
                        "simulations_voice_complete",
                        SimulationVoiceCompleteResponsePayload(
                            success=True,
                            message=f"Finalized {messages_finalized} messages",
                        ),
                        room=sid,
                    )
                else:
                    await emit_to_client(
                        "simulations_voice_complete",
                        SimulationVoiceCompleteResponsePayload(
                            success=False, message="Failed to finalize simulation"
                        ),
                        room=sid,
                    )

    except RuntimeError:
        await emit_to_client(
            "simulations_voice_error",
            SimulationVoiceErrorPayload(
                success=False, message="Database connection pool not available"
            ),
            room=sid,
        )
    except Exception as e:
        await emit_to_client(
            "simulations_voice_complete",
            SimulationVoiceCompleteResponsePayload(success=False, message=str(e)),
            room=sid,
        )


@sio.event  # type: ignore
async def simulation_voice_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_complete event from client."""
    try:
        validated = SimulationVoiceCompletePayload(**data)
        await handle_client_event(
            sid=sid,
            data=validated,
            handler=_simulation_voice_complete_impl,  # type: ignore[arg-type]
            error_event_name="simulations_voice_error",
            error_response_type=SimulationVoiceErrorPayload,
        )
    except ValidationError as e:
        from app.infra.v4.websocket.typed_emit import emit_to_client

        await emit_to_client(
            "simulations_voice_error",
            SimulationVoiceErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


@internal_sio.on("simulation_voice_complete")  # type: ignore
async def simulation_voice_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_voice_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SimulationVoiceCompletePayload,
        handler=_simulation_voice_complete_impl,  # type: ignore[arg-type]
        error_event_name="simulations_voice_error",
        error_response_type=SimulationVoiceErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/simulation_voice_complete",
    SimulationVoiceCompletePayload,
    "Simulation Voice generation completed successfully",
)
