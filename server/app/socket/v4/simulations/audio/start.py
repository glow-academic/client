"""Handle simulation_voice_start event and forward to audio_session_start.

This module receives simulation_voice_start from the client,
extracts simulation context (chat_id, agent_id), and forwards
to audio_session_start. It also listens for audio_session_started
and forwards back to client as simulations_voice_start_response.
"""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetSimulationRunContextSqlParams,
    GetSimulationRunContextSqlRow,
)
from app.socket.v4.simulations.error import SimulationErrorPayload
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/simulations/get_simulation_run_context_complete.sql"


class SimulationVoiceStartPayload(BaseModel):
    """Payload for simulation_voice_start event."""

    chat_id: str


class SimulationVoiceStartResponsePayload(BaseModel):
    """Response payload for simulations_voice_start_response."""

    success: bool
    message: str
    ephemeral_key: str | None = None
    persona_tools: list[dict[str, Any]] = []
    tool_context_map: dict[str, Any] = {}
    instructions: str | None = None
    model: str | None = None
    voice: str | None = None
    transcription_model: str | None = None
    transcription_prompt: str | None = None
    history: list[dict[str, Any]] | None = None


@sio.event  # type: ignore
async def simulation_voice_start(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_start event from client."""
    try:
        payload = SimulationVoiceStartPayload(**data)
        chat_id_uuid = uuid.UUID(payload.chat_id)

        # Get simulation context to determine agent_id
        async with get_db_connection() as conn:
            params = GetSimulationRunContextSqlParams(chat_id=chat_id_uuid)
            result = cast(
                GetSimulationRunContextSqlRow | None,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                await sio.emit(
                    "simulations_voice_start_error",
                    SimulationErrorPayload(
                        success=False,
                        message="Failed to get simulation context",
                    ).model_dump(),
                    room=sid,
                )
                return

            # Determine agent_id (prefer voice_agent_id, fallback to agent_id)
            agent_id = (
                result.voice_agent_id
                if result.voice_agent_id
                else result.agent_id
            )

            if not agent_id:
                await sio.emit(
                    "simulations_voice_start_error",
                    SimulationErrorPayload(
                        success=False,
                        message="No agent configured for voice mode",
                    ).model_dump(),
                    room=sid,
                )
                return

            # Forward to audio_session_start
            await emit_to_internal(
                "audio_session_start",
                {
                    "sid": sid,
                    "agent_id": agent_id,
                    "resource_id": payload.chat_id,
                    "resource_type": "voice",
                    "department_id": result.department_id,
                },
                sid=sid,
            )

    except Exception as e:
        await sio.emit(
            "simulations_voice_start_error",
            SimulationErrorPayload(
                success=False,
                message=f"Failed to start voice session: {str(e)}",
            ).model_dump(),
            room=sid,
        )


@internal_sio.on("audio_session_started")  # type: ignore
async def audio_session_started_listener(data: dict[str, Any]) -> None:
    """Listen for audio_session_started and forward to simulation clients."""
    # Extract resource_id (chat_id) from data
    resource_id = data.get("resource_id")
    resource_type = data.get("resource_type")

    # Only forward if resource_type is "voice" (simulation use case)
    if resource_type != "voice" or not resource_id:
        return

    try:
        chat_id = uuid.UUID(resource_id)
    except (ValueError, TypeError):
        return

    # Build simulation response payload
    response_payload = SimulationVoiceStartResponsePayload(
        success=data.get("success", False),
        message="Voice session started successfully" if data.get("success") else "Failed to start voice session",
        ephemeral_key=data.get("ephemeral_key"),
        persona_tools=data.get("tools", []),
        tool_context_map={},  # TODO: Get from database if needed
        instructions=data.get("instructions"),
        model=data.get("model"),
        voice=data.get("voice"),
        transcription_model=data.get("transcription_model"),
        transcription_prompt=data.get("transcription_prompt"),
        history=data.get("history"),
    )

    # Emit to simulation room
    room_name = f"simulation_{chat_id}"
    await sio.emit(
        "simulations_voice_start_response",
        response_payload.model_dump(),
        room=room_name,
    )
