"""OpenAI audio generation adapter - handles audio generation using Realtime API."""

import uuid
from typing import Any, Literal

import httpx

from ....base.config import AdapterConfig, AdapterEventCallbacks
from ....base.output_adapter import BaseOutputAdapter
from ....base.types import AudioSessionConfig


class OpenAIAudioAdapter(BaseOutputAdapter):
    """OpenAI audio generation adapter - WebRTC implementation."""

    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Returns whether this adapter uses WebRTC or WebSocket."""
        return "webrtc"

    async def initialize_session(
        self,
        config: AdapterConfig,
        resource_id: uuid.UUID,
        resource_type: str,
    ) -> AudioSessionConfig:
        """Initialize audio session - database-free.

        Args:
            config: AdapterConfig with all necessary data (no database access)
            resource_id: Resource ID (chat_id for voice, upload_id for audio)
            resource_type: Resource type ("voice" | "audio")

        Returns:
            AudioSessionConfig with provider-specific details abstracted
        """
        # API key is already decrypted in config
        api_key = config.api_key

        # Generate ephemeral key using OpenAI Realtime API
        model_name = config.model_name or "gpt-realtime-mini"
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
            run_id=str(config.run_id),
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
            conn: Database connection (still needed for persistence)
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

    async def generate_output(
        self,
        sid: str,
        config: AdapterConfig,
        callbacks: AdapterEventCallbacks,
    ) -> AudioSessionConfig:
        """Generate audio output - returns AudioSessionConfig for WebRTC.

        Args:
            sid: Socket ID
            config: AdapterConfig with all necessary data (no database access)
            callbacks: Event callbacks (not used for audio session initialization)

        Returns:
            AudioSessionConfig with provider-specific details
        """
        # Extract resource_id and resource_type from config
        # For audio, resource_id is typically upload_id
        resource_id = config.upload_id if config.upload_id else config.run_id
        resource_type = "audio" if config.upload_id else "voice"

        # Initialize session
        return await self.initialize_session(
            config=config,
            resource_id=resource_id,
            resource_type=resource_type,
        )
