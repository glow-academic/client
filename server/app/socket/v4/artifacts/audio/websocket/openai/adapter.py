"""OpenAI WebSocket audio adapter - server-side audio session management."""

import uuid
from typing import Any

from app.main import get_internal_sio
from app.socket.v4.artifacts.adapters.base.config import AdapterConfig
from app.socket.v4.artifacts.adapters.base.types import AudioSessionConfig

from ...adapter import BaseAudioAdapter
from ..adapter import BaseWebSocketAudioAdapter
from .session import OpenAISession

internal_sio = get_internal_sio()


class OpenAIWebSocketAudioAdapter(BaseWebSocketAudioAdapter):
    """OpenAI WebSocket audio adapter - connects to OpenAI Realtime API via WebSocket."""

    def __init__(
        self,
        run_id: uuid.UUID,
        config: AdapterConfig,
    ) -> None:
        """Initialize OpenAI WebSocket adapter.

        Args:
            run_id: Run ID for the audio session
            config: Adapter configuration
        """
        super().__init__(run_id, config)
        self.session: OpenAISession | None = None
        self._client_sid: str | None = None  # Socket.IO sid for sending audio to client

    async def initialize_session(
        self,
        config: Any,
        resource_id: uuid.UUID,
        resource_type: str,
    ) -> AudioSessionConfig:
        """Initialize audio session - returns WebSocket URL and auth token.

        Args:
            config: AdapterConfig with all necessary data
            resource_id: Resource ID (chat_id for voice, upload_id for audio)
            resource_type: Resource type ("voice" | "audio")

        Returns:
            AudioSessionConfig with websocket_url and auth_token
        """
        # For WebSocket adapter, we return a WebSocket URL that the client connects to
        # The server will proxy audio frames between client and OpenAI
        
        # Generate a session token (could be JWT or simple UUID)
        import secrets
        auth_token = secrets.token_urlsafe(32)
        
        # WebSocket URL is our server endpoint
        # Client connects to: ws://server/audio/websocket/{run_id}?token={auth_token}
        websocket_url = f"/audio/websocket/{self.run_id}"
        
        return AudioSessionConfig(
            type="websocket",
            run_id=str(self.run_id),
            websocket_url=websocket_url,
            auth_token=auth_token,
            model=config.model_name or "gpt-realtime-mini",
            tools=None,  # TODO: Format tools for OpenAI Realtime
            instructions=config.system_prompt,
            history=None,  # TODO: Format conversation history
            voice=None,  # TODO: Get from config
            transcription_model=None,  # TODO: Get from config
            transcription_prompt=None,  # TODO: Get from config
        )

    async def connect(self) -> None:
        """Connect to OpenAI Realtime API WebSocket."""
        if not self.config.api_key:
            raise ValueError("API key is required")
        
        self.session = OpenAISession(
            api_key=self.config.api_key,
            model=self.config.model_name or "gpt-realtime-mini",
            run_id=self.run_id,
            event_handler=self,
        )
        
        await self.session.connect()
        self.set_connected(True)

    async def disconnect(self) -> None:
        """Disconnect from OpenAI Realtime API."""
        if self.session:
            await self.session.disconnect()
        self.set_connected(False)

    async def handle_audio_frame(
        self,
        audio_data: bytes,
    ) -> None:
        """Handle binary audio frame from client.

        Args:
            audio_data: Binary audio frame (PCM16)
        """
        if not self.session:
            return
        
        await self.session.send_audio_frame(audio_data)

    async def handle_event(
        self,
        event_data: dict[str, Any],
    ) -> None:
        """Handle JSON event from client.

        Args:
            event_data: JSON event payload
        """
        if not self.session:
            return
        
        await self.session.send_event(event_data)

    async def send_audio_frame(
        self,
        audio_data: bytes,
    ) -> None:
        """Send binary audio frame to client via Socket.IO.

        Args:
            audio_data: Binary audio frame (PCM16)
        """
        if not self._client_sid:
            return
        
        # Send binary audio frame to client via Socket.IO
        # Socket.IO supports binary data via emit with binary=True
        await internal_sio.emit(
            "audio_websocket_audio",
            audio_data,
            room=self._client_sid,
        )

    def set_client_sid(self, sid: str) -> None:
        """Set Socket.IO sid for sending audio to client.

        Args:
            sid: Socket.IO session ID
        """
        self._client_sid = sid
