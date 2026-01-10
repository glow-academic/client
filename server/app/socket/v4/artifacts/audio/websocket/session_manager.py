"""WebSocket session manager - tracks active audio sessions and routes frames/events."""

import uuid
from typing import Any

from .adapter import BaseWebSocketAudioAdapter


class WebSocketSessionManager:
    """Manages active WebSocket audio sessions by run_id."""

    def __init__(self) -> None:
        """Initialize session manager."""
        self._sessions: dict[str, BaseWebSocketAudioAdapter] = {}

    def register_session(
        self,
        run_id: uuid.UUID,
        adapter: BaseWebSocketAudioAdapter,
    ) -> None:
        """Register a new audio session.

        Args:
            run_id: Run ID for the session
            adapter: WebSocket adapter instance managing the session
        """
        self._sessions[str(run_id)] = adapter

    def get_session(
        self,
        run_id: uuid.UUID,
    ) -> BaseWebSocketAudioAdapter | None:
        """Get session adapter by run_id.

        Args:
            run_id: Run ID for the session

        Returns:
            Adapter instance if found, None otherwise
        """
        return self._sessions.get(str(run_id))

    def unregister_session(
        self,
        run_id: uuid.UUID,
    ) -> None:
        """Unregister a session.

        Args:
            run_id: Run ID for the session
        """
        self._sessions.pop(str(run_id), None)

    def has_session(
        self,
        run_id: uuid.UUID,
    ) -> bool:
        """Check if a session exists.

        Args:
            run_id: Run ID for the session

        Returns:
            True if session exists, False otherwise
        """
        return str(run_id) in self._sessions

    async def handle_audio_frame(
        self,
        run_id: uuid.UUID,
        audio_data: bytes,
    ) -> None:
        """Route binary audio frame to correct session.

        Args:
            run_id: Run ID for the session
            audio_data: Binary audio frame (PCM16 or Opus)
        """
        adapter = self.get_session(run_id)
        if adapter:
            await adapter.handle_audio_frame(audio_data)

    async def handle_event(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Route JSON event to correct session.

        Args:
            run_id: Run ID for the session
            event_data: JSON event payload
        """
        adapter = self.get_session(run_id)
        if adapter:
            await adapter.handle_event(event_data)

    async def cleanup_session(
        self,
        run_id: uuid.UUID,
    ) -> None:
        """Cleanup and unregister a session.

        Args:
            run_id: Run ID for the session
        """
        adapter = self.get_session(run_id)
        if adapter:
            await adapter.disconnect()
        self.unregister_session(run_id)


# Global session manager instance
_session_manager = WebSocketSessionManager()


def get_session_manager() -> WebSocketSessionManager:
    """Get global session manager instance."""
    return _session_manager
