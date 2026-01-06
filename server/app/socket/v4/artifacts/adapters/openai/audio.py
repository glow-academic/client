"""OpenAI audio generation adapter - handles audio generation using Realtime API."""

import uuid
from typing import Any, cast

import asyncpg  # type: ignore
import httpx

from app.main import get_internal_sio
from app.sql.types import (
    GetAudioRunContextAndCreateRunSqlParams,
    GetAudioRunContextAndCreateRunSqlRow,
)
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/audio/get_audio_run_context_and_create_run_complete.sql"


class OpenAIAudioAdapter:
    """OpenAI audio generation adapter."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> None:
        """Generate audio using OpenAI Realtime API (ephemeral sessions).

        Args:
            sid: Socket ID
            data: Request data containing uploadId, prompt, agentId, departmentId
            profile_id: Profile ID (optional)
            conn: Database connection
        """
        upload_id = uuid.UUID(data.get("uploadId", "")) if data.get("uploadId") else None
        agent_id = uuid.UUID(data.get("agentId", ""))
        department_id = uuid.UUID(data.get("departmentId", "")) if data.get("departmentId") else None

        try:
            # Get agent context AND create run in single atomic transaction
            try:
                params = GetAudioRunContextAndCreateRunSqlParams(
                    upload_id=upload_id,
                    agent_id=agent_id,
                    profile_id=profile_id,
                    department_id=department_id,
                )
                result = cast(
                    GetAudioRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                error_msg = str(e)
                # Check if it's a rate limit error from SQL
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
                # Generate ephemeral key using OpenAI Realtime API
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
                str(data.get("uploadId", "")) if data.get("uploadId") else None
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

