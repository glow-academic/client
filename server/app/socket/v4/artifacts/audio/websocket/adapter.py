"""Base WebSocket audio adapter - handles binary audio frames and JSON events."""

import uuid
from abc import ABC, abstractmethod
from typing import Any, Literal

from ..adapter import BaseAudioAdapter


class BaseWebSocketAudioAdapter(BaseAudioAdapter):
    """Base WebSocket audio adapter - handles binary audio frames and JSON events."""

    def __init__(
        self,
        run_id: uuid.UUID,
        config: Any,
    ) -> None:
        """Initialize WebSocket adapter.

        Args:
            run_id: Run ID for the audio session
            config: Adapter configuration
        """
        self.run_id = run_id
        self.config = config
        self._connected = False

    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Returns WebSocket implementation type."""
        return "websocket"

    @abstractmethod
    async def connect(self) -> None:
        """Connect to provider WebSocket endpoint."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from provider WebSocket endpoint."""
        pass

    @abstractmethod
    async def handle_audio_frame(
        self,
        audio_data: bytes,
    ) -> None:
        """Handle binary audio frame from client.

        Args:
            audio_data: Binary audio frame (PCM16 or Opus)
        """
        pass

    @abstractmethod
    async def handle_event(
        self,
        event_data: dict[str, Any],
    ) -> None:
        """Handle JSON event from client.

        Args:
            event_data: JSON event payload
        """
        pass

    @abstractmethod
    async def send_audio_frame(
        self,
        audio_data: bytes,
    ) -> None:
        """Send binary audio frame to client.

        Args:
            audio_data: Binary audio frame (PCM16 or Opus)
        """
        pass

    def is_connected(self) -> bool:
        """Check if adapter is connected."""
        return self._connected

    def set_connected(self, connected: bool) -> None:
        """Set connection state."""
        self._connected = connected
