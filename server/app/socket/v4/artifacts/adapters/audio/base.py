"""Base audio adapter interface for voice mode."""

from abc import ABC, abstractmethod
from typing import Any, Literal

from pydantic import BaseModel

from app.socket.v4.artifacts.session_store import AudioSession


class AudioSessionConfig(BaseModel):
    """Configuration returned when initializing an audio session."""

    ephemeral_key: str | None = None  # For WebRTC client-side connections
    model: str
    voice: str | None = None
    instructions: str | None = None
    tools: list[dict[str, Any]] | None = None
    turn_detection: dict[str, Any] | None = None
    expires_in: int | None = None  # Seconds until ephemeral key expires


class BaseAudioAdapter(ABC):
    """Base class for audio adapters.

    Audio adapters handle bidirectional audio streaming between clients and AI providers.
    Two implementation types are supported:

    - **WebRTC**: Client connects directly to provider (e.g., OpenAI Realtime API with ephemeral key)
    - **WebSocket**: Server maintains connection to provider, relays audio via Socket.IO

    For WebSocket adapters, the adapter consumes from session.inbound_queue and emits
    events via internal_sio for outbound audio.
    """

    @abstractmethod
    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Return the implementation type for this adapter.

        Returns:
            "webrtc" if client connects directly to provider
            "websocket" if server maintains the connection
        """
        pass

    @abstractmethod
    async def initialize_session(
        self,
        session: AudioSession,
        api_key: str,
        model: str,
        voice: str | None = None,
        instructions: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AudioSessionConfig:
        """Initialize an audio session.

        For WebRTC adapters, this generates an ephemeral key and returns config.
        For WebSocket adapters, this establishes the connection and starts loops.

        Args:
            session: The AudioSession containing queues and metadata
            api_key: Decrypted API key for the provider
            model: Model to use (e.g., "gpt-4o-realtime-preview")
            voice: Voice to use for TTS
            instructions: System instructions for the session
            tools: Tools available to the model
            **kwargs: Additional provider-specific options

        Returns:
            AudioSessionConfig with session details
        """
        pass

    @abstractmethod
    async def stop_session(self, session: AudioSession) -> None:
        """Stop an audio session and clean up resources.

        Args:
            session: The AudioSession to stop
        """
        pass
