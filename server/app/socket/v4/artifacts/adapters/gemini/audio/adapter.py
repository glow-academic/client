"""Gemini audio generation adapter - stub implementation."""

import uuid
from typing import Any, Literal

from ....base.types import AgentConfig, AudioSessionConfig
from ....base.output_adapter import BaseOutputAdapter


class GeminiAudioAdapter(BaseOutputAdapter):
    """Gemini audio generation adapter - not yet implemented."""

    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Returns whether this adapter uses WebRTC or WebSocket."""
        return "websocket"  # Gemini will use WebSocket

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
        raise NotImplementedError("Gemini audio adapter not yet implemented")

    async def handle_webrtc_event(
        self,
        conn: Any,
        event_type: str,
        event_data: dict[str, Any],
        run_id: uuid.UUID,
    ) -> None:
        """Handle WebRTC/WebSocket events - not yet implemented."""
        raise NotImplementedError("Gemini audio adapter not yet implemented")

    async def generate_output(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> AudioSessionConfig:
        """Generate audio output - not yet implemented."""
        raise NotImplementedError("Gemini audio adapter not yet implemented")
