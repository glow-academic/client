"""Handler for generate_audio WebSocket event - starts audio generation session (NO event dispatch)."""

import os
import uuid
from typing import Any, cast

import httpx
from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (GetAudioRunContextAndCreateRunSqlParams,
                           GetAudioRunContextAndCreateRunSqlRow)
from fastapi import APIRouter
from pydantic import BaseModel
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/audio/get_audio_run_context_and_create_run_complete.sql"


class GenerateAudioPayload(BaseModel):
    """Request to start audio generation session."""

    uploadId: str  # Input audio upload_id (optional - can be None for text-to-audio)
    prompt: str  # Text prompt for audio generation
    agentId: str  # Audio agent ID
    departmentId: str | None = None  # Optional department ID


async def _generate_audio_impl(sid: str, data: GenerateAudioPayload) -> None:
    """Handle audio generation session start - NO event dispatch after start."""
    try:
        upload_id = uuid.UUID(data.uploadId) if data.uploadId else None
        agent_id = uuid.UUID(data.agentId)
        department_id = uuid.UUID(data.departmentId) if data.departmentId else None

        # Get profile_id from sid lookup (O(1) Redis lookup)
        # Audio generation can work without profile_id (guest mode)
        profile_id_str = await find_profile_by_socket(sid)
        profile_id = uuid.UUID(profile_id_str) if profile_id_str else None

        async with get_db_connection() as conn:
            # Get agent context AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                params = GetAudioRunContextAndCreateRunSqlParams(
                    upload_id=upload_id,  # Can be None for text-to-audio
                    agent_id=agent_id,
                    profile_id=profile_id,  # Can be None for guest mode
                    department_id=department_id,
                )
                result = cast(
                    GetAudioRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await internal_sio.emit(
                        "generate_audio_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                            "upload_id": str(upload_id) if upload_id else None,
                        },
                    )
                    return
                await internal_sio.emit(
                    "generate_audio_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize audio generation: {str(e)}",
                        "upload_id": str(upload_id) if upload_id else None,
                    },
                )
                return

            if not result:
                await internal_sio.emit(
                    "generate_audio_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": (
                            "No audio agent configured. "
                            "Please configure an audio agent in system settings."
                        ),
                        "upload_id": str(upload_id) if upload_id else None,
                    },
                )
                return

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            if not result.api_key:
                agent_name = result.agent_name or "audio agent"
                model_name = result.model_name or "unknown model"
                await internal_sio.emit(
                    "generate_audio_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": (
                            f"API key not found for {agent_name} (model: {model_name}). "
                            "Please link an API key to the model in system settings."
                        ),
                        "upload_id": str(upload_id) if upload_id else None,
                    },
                )
                return

            # Extract context data
            encrypted_api_key = result.api_key
            model_name = result.model_name
            provider = result.provider

            # Decrypt the API key
            try:
                api_key = decrypt_api_key(encrypted_api_key)
            except ValueError as e:
                await internal_sio.emit(
                    "generate_audio_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": (
                            f"Failed to decrypt API key for {result.agent_name or 'audio agent'}: {str(e)}"
                        ),
                        "upload_id": str(upload_id) if upload_id else None,
                    },
                )
                return

            # Provider-specific audio generation logic - generate ephemeral session
            ephemeral_key = None
            expires_in = None

            if provider == "openai":
                # Generate ephemeral key using OpenAI Realtime API (same pattern as voice agent)
                # For audio generation, we use the realtime API with audio session type
                ephemeral_model = model_name or "gpt-realtime-mini"
                try:
                    async with httpx.AsyncClient() as http_client:
                        response = await http_client.post(
                            "https://api.openai.com/v1/realtime/client_secrets",
                            headers={
                                "Authorization": f"Bearer {api_key}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "session": {
                                    "type": "realtime",
                                    "model": ephemeral_model,
                                }
                            },
                            timeout=30.0,
                        )
                        response.raise_for_status()
                        response_data = response.json()
                        ephemeral_key = response_data.get("value")
                        expires_in = response_data.get("expires_in", 3600)

                        if not ephemeral_key:
                            raise ValueError("No ephemeral key in response")

                except Exception as e:
                    await internal_sio.emit(
                        "generate_audio_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": f"Failed to generate ephemeral key: {str(e)}",
                            "upload_id": str(upload_id) if upload_id else None,
                        },
                    )
                    return
            else:
                # Other provider implementation
                # TODO: Implement provider-specific logic for other providers
                await internal_sio.emit(
                    "generate_audio_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Provider {provider} not yet supported for audio generation",
                        "upload_id": str(upload_id) if upload_id else None,
                    },
                )
                return

            # CRITICAL: Does NOT emit progress or completion events
            # Just returns ephemeral key and session info via start.py
            # Frontend handles progress/completion via WebSocket or polling
            await internal_sio.emit(
                "generate_audio_started",
                {
                    "sid": sid,
                    "success": True,
                    "ephemeral_key": ephemeral_key,
                    "expires_in": expires_in,
                    "model": model_name,
                    "upload_id": str(upload_id) if upload_id else None,
                    "run_id": str(model_run_id),
                    "message": "Audio generation session started",
                },
            )

    except Exception as e:
        upload_id_str = (
            str(data.uploadId) if hasattr(data, "uploadId") and data.uploadId else None
        )
        await internal_sio.emit(
            "generate_audio_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
                "upload_id": upload_id_str,
            },
        )


@sio.event  # type: ignore
async def generate_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler (client-to-server)."""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GenerateAudioPayload,
        handler=_generate_audio_impl,  # type: ignore[arg-type]
        error_event_name="audio_generation_error",
        error_response_type=None,
    )


@internal_sio.on("generate_audio")  # type: ignore
async def generate_audio_internal(data: dict[str, Any]) -> None:
    """Handle generate_audio event from internal bus (server-to-server)."""
    try:
        payload = GenerateAudioPayload(**data)
        sid = data.get("sid", "")
        if not sid:
            return
        await _generate_audio_impl(sid, payload)
    except Exception as e:
        upload_id = data.get("uploadId", None)
        sid = data.get("sid", "")
        if sid:
            await internal_sio.emit(
                "generate_audio_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": f"Invalid request: {str(e)}",
                    "upload_id": str(upload_id) if upload_id else None,
                },
            )


register_client_endpoint(
    client_router,
    "/generate_audio_start",
    GenerateAudioPayload,
    "Start audio generation session - generates ephemeral key",
)
