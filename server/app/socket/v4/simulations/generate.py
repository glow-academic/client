"""Simulation voice generation router - unified handler for voice mode."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.socket.v4.simulations.error import SimulationErrorPayload
from app.sql.types import (GetGroupIdFromChatGroupV4SqlParams,
                           GetGroupIdFromChatGroupV4SqlRow,
                           GetSimulationRunContextSqlParams,
                           GetSimulationRunContextSqlRow)
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/simulations/get_simulation_run_context_complete.sql"
GET_GROUP_ID_SQL_PATH = "app/sql/v4/simulations/get_group_id_from_chat_group_v4_complete.sql"


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
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to get simulation context",
                        artifact_type="simulation",
                        group_id=None,
                        resource_type="voice",
                    ),
                    sid=sid,
                )
                return

            # Determine agent_id (prefer voice_agent_id, fallback to agent_id)
            agent_id = (
                result.voice_agent_id if result.voice_agent_id else result.agent_id
            )

            if not agent_id:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="No agent configured for voice mode",
                        artifact_type="simulation",
                        group_id=None,
                        resource_type="voice",
                    ),
                    sid=sid,
                )
                return

            # Get group_id from chat (if exists)
            group_params = SocketGetGroupIdFromChatGroupSqlParams(chat_id=chat_id_uuid)
            group_result = cast(
                GetGroupIdFromChatGroupV4SqlRow,
                await execute_sql_typed(conn, GET_GROUP_ID_SQL_PATH, params=group_params),
            )
            group_id = str(group_result.group_id) if group_result and group_result.group_id else None

            # Emit generate_artifact internal event
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "simulation",
                    "agent_id": str(agent_id),
                    "resource_types": ["voice"],
                    "resource_id": str(chat_id_uuid),
                    "group_id": str(group_id) if group_id else None,
                    "department_id": str(result.department_id) if result.department_id else None,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to start voice session: {str(e)}",
                artifact_type="simulation",
                group_id=None,
                resource_type="voice",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def simulation_voice_start(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_start event (client-to-server)."""
    try:
        payload = SimulationVoiceStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "simulations_voice_start_error",
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
            "simulations_voice_start_error",
            SimulationErrorPayload(
                success=False,
                message=f"Invalid request: {str(e)}",
            ).model_dump(),
            room=sid,
        )
