"""Attempt audio start handler.

Handles WebSocket event:
- attempt_audio_start: Start a voice session (BFF pre-generation validation)

After validation, emits generate_artifact with modality="audio" to
centralize session creation in generate.py.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.attempt.get import get_attempt_websocket
from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import (
    get_internal_sio,
    get_pool,
    sio,
)
from app.socket.v4.artifacts.attempt.types import (
    AttemptAudioReadyEvent,
    AttemptAudioStartPayload,
    AttemptUnifiedErrorEvent,
)
from app.sql.types import GetAudioStartContextSqlParams, GetAudioStartContextSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_AUDIO_START_CONTEXT = (
    "app/sql/v4/queries/generate/attempt/get_audio_start_context_complete.sql"
)


@sio.event  # type: ignore
async def attempt_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_start event - start a voice session.

    BFF Translation: Client sends chat_id, server validates context and config,
    then emits generate_artifact with modality="audio" to centralize session
    creation in generate.py. Emits attempt_audio_ready with chat_id on success.
    """
    try:
        payload = AttemptAudioStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        chat_id = str(payload.chat_id)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=None,
                    type="audio",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)

        # Generate unique group_id for this voice session (like SQL does for text)
        group_id = str(uuid.uuid4())

        # Step 1: Lightweight context SQL — resolve chat_id → attempt_id
        async with get_db_connection() as conn:
            context_row = cast(
                GetAudioStartContextSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_AUDIO_START_CONTEXT,
                    params=GetAudioStartContextSqlParams(
                        p_profile_id=profile_id,
                        p_chat_id=payload.chat_id,
                    ),
                ),
            )

        if not context_row or not context_row.chat_exists:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=group_id,
                    type="audio",
                    message="Chat not found",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        if context_row.chat_is_completed:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=group_id,
                    type="audio",
                    message="Chat is already completed",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Rate limit validation (mirrors text flow in message.py)
        requests_per_day = context_row.requests_per_day
        runs_today = context_row.runs_today or 0
        if requests_per_day is not None and runs_today >= requests_per_day:
            error_msg = (
                f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
            )
            logger.error(
                f"Audio start rate limit exceeded - "
                f"profile_id={profile_id}, chat_id={chat_id}"
            )
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=group_id,
                    type="audio",
                    message=error_msg,
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        attempt_id = context_row.attempt_id
        if not attempt_id:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=group_id,
                    type="audio",
                    message="Attempt not found for this chat",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 2: get_attempt_websocket() → cached resources (providers, agents, models)
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        async with pool.acquire() as conn:
            result = await get_attempt_websocket(
                conn=conn,
                profile_id=profile_id,
                attempt_id=attempt_id,
            )

        if not result.resources:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=group_id,
                    type="audio",
                    message="Failed to fetch voice configuration",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 3: Extract config from pre-fetched resources
        config_providers = result.resources.providers or []
        config_agents = result.resources.agents or []
        config_models = result.resources.models or []

        provider_resource = config_providers[0] if config_providers else None
        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None

        # Get API key from provider resource
        encrypted_api_key = provider_resource.key if provider_resource else None
        if not encrypted_api_key:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=group_id,
                    type="audio",
                    message="No API key configured for voice mode",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Extract voice from agent resource (fallback to "alloy")
        voice = "alloy"
        if agent_resource and hasattr(agent_resource, "voice") and agent_resource.voice:
            voice = agent_resource.voice

        # Extract model name from model resource (fallback to hardcoded realtime model)
        model_name = "gpt-4o-realtime-preview-2024-12-17"
        if model_resource and model_resource.value:
            model_name = model_resource.value

        # Extract base_url from provider resource
        base_url = (
            provider_resource.endpoint if hasattr(provider_resource, "endpoint") else ""
        )

        # Step 4: Emit generate_artifact — session creation happens in generate.py
        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "artifact_type": "attempt",
                "modality": "audio",
                "run_id": str(uuid.uuid4()),
                "group_id": group_id,
                "chat_id": chat_id,
                "messages": [],
                "llm_config": {
                    "model": model_name,
                    "api_key": encrypted_api_key,
                    "base_url": base_url,
                    "voice": voice,
                },
            },
        )

        logger.info(
            f"Audio start emitted generate_artifact - "
            f"chat_id={chat_id}, group_id={group_id}, model={model_name}"
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.audio.started",
                template="{{ actor.name }} started voice session",
                context={"chat_id": chat_id, "group_id": group_id},
                endpoint="/socket/v4/attempt/audio_start",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_audio_start: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                group_id=None,
                type="audio",
                message=f"Failed to start voice session: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("generate_audio_start")  # type: ignore
async def handle_audio_start(data: dict[str, Any]) -> None:
    """Translate generate_audio_start → attempt_audio_ready for client."""
    group_id = data.get("group_id")
    sid = data.get("sid")
    if not sid or not group_id:
        return
    session = get_session_by_group_id(group_id)
    chat_id = session.chat_id if session else group_id
    await sio.emit(
        "attempt_audio_ready",
        AttemptAudioReadyEvent(
            chat_id=chat_id, success=True, message="Voice session ready"
        ).model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/audio_start", response_model=dict[str, bool])
async def attempt_audio_start_api(request: AttemptAudioStartPayload) -> dict[str, bool]:
    """Client-to-server event: Start a voice session."""
    return {"success": True}


@server_router.post("/attempt/audio_ready", response_model=dict[str, bool])
async def attempt_audio_ready_api(request: AttemptAudioReadyEvent) -> dict[str, bool]:
    """Server-to-client event: Voice session is ready."""
    return {"success": True}
