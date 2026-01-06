"""OpenAI audio generation adapter - handles audio generation using Realtime API."""

import uuid
from typing import Any, Literal, cast

import asyncpg  # type: ignore
import httpx
from app.main import get_internal_sio
from app.sql.types import (GetAudioRunContextAndCreateRunSqlParams,
                           GetAudioRunContextAndCreateRunSqlRow)
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed, load_sql

from ..base import AgentConfig, AudioSessionConfig
from .base import BaseAudioAdapter

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/audio/get_audio_run_context_and_create_run_complete.sql"


class OpenAIAudioAdapter(BaseAudioAdapter):
    """OpenAI audio generation adapter - WebRTC implementation."""

    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Returns whether this adapter uses WebRTC or WebSocket."""
        return "webrtc"

    async def initialize_session(
        self,
        conn: Any,
        agent_config: AgentConfig,
        resource_id: uuid.UUID,
        resource_type: str,
        run_id: uuid.UUID,
        **kwargs: Any,
    ) -> AudioSessionConfig:
        """Initialize audio session - adapter fetches what it needs from DB.

        Args:
            conn: Database connection
            agent_config: Agent configuration from SQL
            resource_id: Resource ID (chat_id for voice, upload_id for audio)
            resource_type: Resource type ("voice" | "audio")
            run_id: Run ID (already created)
            **kwargs: Additional parameters

        Returns:
            AudioSessionConfig with provider-specific details abstracted
        """
        # Decrypt API key
        if not agent_config.api_key:
            raise ValueError(f"API key not found for agent {agent_config.agent_id}")

        try:
            api_key = decrypt_api_key(agent_config.api_key)
        except ValueError as e:
            raise ValueError(f"Failed to decrypt API key: {str(e)}")

        # Generate ephemeral key using OpenAI Realtime API
        model_name = agent_config.model_name or "gpt-realtime-mini"
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
                            "model": model_name,
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
            raise ValueError(f"Failed to generate ephemeral key: {str(e)}")

        # TODO: Fetch personas, tools, and history from DB and format for OpenAI Realtime
        # For now, return basic config - full implementation will fetch:
        # - Personas via get_chat_personas.sql (if resource_type == "voice")
        # - Tools via socket_get_agent_tools_v4 SQL function
        # - History via get_simulation_messages_complete.sql (if resource_type == "voice")
        # Then format them for OpenAI Realtime format

        return AudioSessionConfig(
            type="webrtc",
            run_id=str(run_id),
            ephemeral_key=ephemeral_key,
            expires_in=expires_in,
            model=model_name,
            tools=None,  # TODO: Format tools for OpenAI Realtime
            instructions=None,  # TODO: Format system prompt + persona instructions
            history=None,  # TODO: Format conversation history for OpenAI Realtime
        )

    async def handle_webrtc_event(
        self,
        conn: Any,
        event_type: str,
        event_data: dict[str, Any],
        run_id: uuid.UUID,
    ) -> None:
        """Handle WebRTC forwarding events from frontend.

        Args:
            conn: Database connection
            event_type: Event type (audio_user_start, audio_assistant_progress, etc.)
            event_data: Event payload data
            run_id: Run ID
        """
        # TODO: Implement WebRTC event handling
        # This will handle events like:
        # - audio_user_start, audio_user_progress, audio_user_complete
        # - audio_assistant_start, audio_assistant_progress, audio_assistant_complete
        # - audio_tool_call_start, audio_tool_call_progress, audio_tool_call_complete
        # - audio_user_audio_link, audio_assistant_audio_link
        # - audio_session_usage, audio_session_interrupt
        # - audio_error
        # Each event will route to appropriate persistence helpers
        raise NotImplementedError("WebRTC event handling not yet implemented")

