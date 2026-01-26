"""Simulation voice generation router - unified handler for voice mode."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.socket.v4.attempts.practice.error import SimulationErrorPayload
from app.sql.types import (
    GetSimulationRunContextSqlParams,
    GetSimulationRunContextSqlRow,
)
from fastapi import APIRouter
from pydantic import BaseModel
from app.utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/simulations/get_simulation_run_context_complete.sql"
GET_GROUP_ID_SQL_PATH = "app/sql/v4/queries/simulations/get_group_id_from_chat_group_v4_complete.sql"
CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"


class SimulationVoiceStartPayload(BaseModel):
    """Payload for simulation_voice_start event."""

    chat_id: str


async def _simulation_voice_generate_impl(
    sid: str, data: SimulationVoiceStartPayload, profile_id: uuid.UUID
) -> None:
    """Handle simulation voice generation - emit generate_artifact for voice resource type."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)

        # Get simulation context to determine agent_id and department_id
        async with get_db_connection() as conn:
            params = GetSimulationRunContextSqlParams(chat_id=chat_id_uuid)
            result = cast(
                GetSimulationRunContextSqlRow | None,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                await internal_sio.emit(
                    "generate_audio_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to get simulation context",
                        artifact_type="simulation",
                        group_id=None,
                        resource_type="voice",
                    ).model_dump(),
                )
                return

            # Determine agent_id (prefer voice_agent_id, fallback to agent_id)
            agent_id = (
                result.voice_agent_id if result.voice_agent_id else result.agent_id
            )

            if not agent_id:
                await internal_sio.emit(
                    "generate_audio_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="No agent configured for voice mode",
                        artifact_type="simulation",
                        group_id=None,
                        resource_type="voice",
                    ).model_dump(),
                )
                return

            # Get group_id from chat (if exists)
            group_id: str | None = None
            group_sql = load_sql(GET_GROUP_ID_SQL_PATH)
            group_row = await conn.fetchrow(group_sql, chat_id_uuid)
            if group_row and group_row.get("group_id"):
                group_id = str(group_row["group_id"])

            # Create run for voice generation
            create_run_sql = load_sql(CREATE_RUN_SQL_PATH)
            create_run_row = await conn.fetchrow(
                create_run_sql,
                uuid.UUID(str(agent_id)),
                profile_id,
                None,
                uuid.UUID(result.department_id) if result.department_id else None,
                uuid.UUID(group_id) if group_id else None,
                None,
                None,
                None,
            )
            if not create_run_row:
                await internal_sio.emit(
                    "generate_audio_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create run for voice generation",
                        artifact_type="simulation",
                        group_id=group_id,
                        resource_type="voice",
                    ).model_dump(),
                )
                return

            run_id = str(create_run_row["run_id"])
            group_id = str(create_run_row["group_id"]) if create_run_row.get("group_id") else group_id
            trace_id = create_run_row.get("trace_id")

            voice_system_prompt = result.voice_system_prompt or result.system_prompt
            messages: list[dict[str, Any]] = []
            if voice_system_prompt:
                messages.append({"role": "system", "content": voice_system_prompt})

            # Emit generate_artifact internal event
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "simulation",
                    "resource_type": "voice",
                    "run_id": run_id,
                    "group_id": group_id,
                    "chat_id": str(chat_id_uuid),
                    "message_id": None,
                    "modality": "audio",
                    "messages": messages,
                    "model_config": {
                        "model": result.voice_model_name or result.model_name,
                        "api_key": result.voice_api_key or result.api_key,
                        "base_url": result.voice_base_url or result.base_url,
                        "temperature": result.voice_temperature or result.temperature,
                        "reasoning": result.voice_reasoning or result.reasoning,
                        "provider": result.voice_provider or result.provider,
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        await internal_sio.emit(
            "generate_audio_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to start voice session: {str(e)}",
                artifact_type="simulation",
                group_id=None,
                resource_type="voice",
            ).model_dump(),
        )


@sio.event  # type: ignore
async def simulation_voice_start(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_start event (client-to-server)."""
    try:
        payload = SimulationVoiceStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "simulation_voice_start_error",
                SimulationErrorPayload(
                    success=False,
                    message="Profile not found. Please reconnect.",
                ).model_dump(),
                room=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _simulation_voice_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await sio.emit(
            "simulation_voice_start_error",
            SimulationErrorPayload(
                success=False,
                message=f"Invalid request: {str(e)}",
            ).model_dump(),
            room=sid,
        )
