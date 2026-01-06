"""Gemini WebSocket audio generation adapter - stub implementation."""

import uuid
from typing import Any, Literal

from ..base import AgentConfig, AudioSessionConfig
from .base import BaseAudioAdapter


class GeminiWebSocketAudioAdapter(BaseAudioAdapter):
    """Gemini WebSocket audio generation adapter - not yet implemented."""

    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Returns whether this adapter uses WebRTC or WebSocket."""
        return "websocket"

    async def initialize_session(
        self,
        conn: Any,
        agent_config: AgentConfig,
        resource_id: uuid.UUID,
        resource_type: str,
        run_id: uuid.UUID,
        **kwargs: Any,
    ) -> AudioSessionConfig:
        """Initialize audio session - not yet implemented."""
        raise NotImplementedError("Gemini WebSocket audio adapter not yet implemented")

    async def handle_webrtc_event(
        self,
        conn: Any,
        event_type: str,
        event_data: dict[str, Any],
        run_id: uuid.UUID,
    ) -> None:
        """Handle WebRTC forwarding events - not yet implemented."""
        raise NotImplementedError("Gemini WebSocket audio adapter does not support WebRTC events")

