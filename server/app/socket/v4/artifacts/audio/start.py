"""Unified audio session start handler - routes to WebSocket or WebRTC adapter."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (
    GetAudioRunContextAndCreateRunSqlParams,
    GetAudioRunContextAndCreateRunSqlRow,
)
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

from ..adapters.openai.audio.adapter import OpenAIAudioAdapter as OpenAIWebRTCAdapter
from ..base.types import AgentConfig
from ..adapters.service.prepare_config import prepare_audio_config
from app.infra.v4.websocket.typed_emit import emit_to_internal
from .websocket.openai.adapter import OpenAIWebSocketAudioAdapter
from .websocket.session_manager import get_session_manager

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/audio/get_audio_run_context_and_create_run_complete.sql"


class AudioSessionStartApiRequest(BaseModel):
    """Payload for audio session start - DHH-style minimal data."""

    agent_id: str
    resource_id: str  # chat_id for voice, upload_id for audio
    resource_type: str  # "voice" | "audio"
    department_id: str | None = None
    implementation_type: str | None = None  # "webrtc" | "websocket" - defaults to webrtc for backward compat


async def _audio_session_start_impl(
    sid: str,
    data: AudioSessionStartApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle audio session start - routes to appropriate adapter.

    Determines adapter type (WebSocket vs WebRTC) and initializes appropriate adapter.
    """
    try:
        async with get_db_connection() as conn:
            # Get agent context + create run atomically
            try:
                upload_id_for_audio = (
                    uuid.UUID(data.resource_id)
                    if data.resource_type == "audio"
                    else uuid.UUID("00000000-0000-0000-0000-000000000000")
                )
                params = GetAudioRunContextAndCreateRunSqlParams(
                    upload_id=upload_id_for_audio,
                    agent_id=uuid.UUID(data.agent_id),
                    profile_id=profile_id,
                    department_id=uuid.UUID(data.department_id) if data.department_id else None,
                )
                result = cast(
                    GetAudioRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to initialize audio session: {str(e)}",
                        resource_id=data.resource_id,
                        resource_type=data.resource_type,
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="No audio agent configured",
                        resource_id=data.resource_id,
                        resource_type=data.resource_type,
                    ),
                    sid=sid,
                )
                return

            # Build AgentConfig from SQL result
            agent_config = AgentConfig(
                agent_id=result.agent_id or "",
                agent_name=getattr(result, "agent_name", None),
                system_prompt=getattr(result, "system_prompt", None),
                temperature=getattr(result, "temperature", None),
                reasoning=getattr(result, "reasoning", None),
                model_id=getattr(result, "model_id", None),
                model_name=getattr(result, "model_name", None),
                provider=getattr(result, "provider", None) or "openai",
                base_url=getattr(result, "base_url", None),
                api_key=getattr(result, "api_key", None),
                custom_model=getattr(result, "custom_model", None),
                provider_id=getattr(result, "provider_id", None),
                provider_name=getattr(result, "provider_name", None),
            )

            # Determine implementation type (default to webrtc for backward compatibility)
            implementation_type = data.implementation_type or "webrtc"
            
            # Determine provider and get adapter
            provider = agent_config.provider or "openai"
            if provider != "openai":
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Provider {provider} not yet supported for audio",
                        resource_id=data.resource_id,
                        resource_type=data.resource_type,
                    ),
                    sid=sid,
                )
                return

            # Prepare adapter config using service layer
            run_id = uuid.UUID(result.run_id)
            resource_id_uuid = uuid.UUID(data.resource_id)
            adapter_config = await prepare_audio_config(
                conn=conn,
                agent_config=agent_config,
                resource_id=resource_id_uuid,
                resource_type=data.resource_type,
                run_id=run_id,
            )

            # Initialize appropriate adapter based on implementation type
            if implementation_type == "websocket":
                # WebSocket adapter - server-side audio processing
                adapter = OpenAIWebSocketAudioAdapter(
                    run_id=run_id,
                    config=adapter_config,
                )
                
                # Initialize session
                session_config = await adapter.initialize_session(
                    config=adapter_config,
                    resource_id=resource_id_uuid,
                    resource_type=data.resource_type,
                )
                
                # Register session with session manager
                session_manager = get_session_manager()
                session_manager.register_session(run_id, adapter)
                
                # Set client sid for sending audio frames
                adapter.set_client_sid(sid)
                
                # Connect to OpenAI
                await adapter.connect()
                
            elif implementation_type == "webrtc":
                # WebRTC adapter - client-side processing (existing behavior)
                adapter = OpenAIWebRTCAdapter()
                session_config = await adapter.initialize_session(
                    config=adapter_config,
                    resource_id=resource_id_uuid,
                    resource_type=data.resource_type,
                )
            else:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Unknown implementation type: {implementation_type}",
                        resource_id=data.resource_id,
                        resource_type=data.resource_type,
                    ),
                    sid=sid,
                )
                return

            # Emit session config to frontend
            await internal_sio.emit(
                "audio_session_started",
                {
                    "sid": sid,
                    "success": True,
                    "type": session_config.type,
                    "run_id": session_config.run_id,
                    "ephemeral_key": session_config.ephemeral_key,
                    "expires_in": session_config.expires_in,
                    "model": session_config.model,
                    "tools": session_config.tools,
                    "instructions": session_config.instructions,
                    "history": session_config.history,
                    "voice": session_config.voice,
                    "transcription_model": session_config.transcription_model,
                    "transcription_prompt": session_config.transcription_prompt,
                    "websocket_url": session_config.websocket_url,
                    "auth_token": session_config.auth_token,
                    "resource_id": data.resource_id,
                    "resource_type": data.resource_type,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to start audio session: {str(e)}",
                resource_id=data.resource_id,
                resource_type=data.resource_type,
            ),
            sid=sid,
        )


@internal_sio.on("audio_session_start")  # type: ignore
async def audio_session_start_internal(data: dict[str, Any]) -> None:
    """Handle audio_session_start event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=AudioSessionStartApiRequest,
        handler=_audio_session_start_impl,  # type: ignore[arg-type]
        error_event_name="generate_error",
        error_response_type=GenerateErrorApiRequest,
    )
