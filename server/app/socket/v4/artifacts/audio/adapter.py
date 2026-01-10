"""Base audio adapter interface with 14 standardized event methods.

All audio adapters (WebSocket, WebRTC) must implement this interface.
Each method emits standardized events via internal_sio for simulation handlers to forward.
"""

import uuid
from abc import ABC, abstractmethod
from typing import Any, Literal

from app.main import get_internal_sio

internal_sio = get_internal_sio()


class BaseAudioAdapter(ABC):
    """Base interface for all audio adapters (WebSocket and WebRTC)."""

    @abstractmethod
    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Returns whether this adapter uses WebRTC or WebSocket."""
        pass

    @abstractmethod
    async def initialize_session(
        self,
        config: Any,
        resource_id: uuid.UUID,
        resource_type: str,
    ) -> Any:
        """Initialize audio session and return AudioSessionConfig."""
        pass

    # 14 Standardized Event Methods
    # Each method emits via internal_sio.emit() for simulation handlers to forward

    async def emit_audio_user_start(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_user_start event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with item_id, audio_start_ms, etc.
        """
        await internal_sio.emit(
            "audio_user_start",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_user_progress(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_user_progress event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with transcript delta, etc.
        """
        await internal_sio.emit(
            "audio_user_progress",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_user_complete(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_user_complete event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with final transcript, upload_id, etc.
        """
        await internal_sio.emit(
            "audio_user_complete",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_assistant_start(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_assistant_start event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with call_id, item_id, etc.
        """
        await internal_sio.emit(
            "audio_assistant_start",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_assistant_progress(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_assistant_progress event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with tool call delta, etc.
        """
        await internal_sio.emit(
            "audio_assistant_progress",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_assistant_complete(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_assistant_complete event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with final arguments, upload_id, etc.
        """
        await internal_sio.emit(
            "audio_assistant_complete",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_tool_call_start(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_tool_call_start event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with call_id, tool_name, etc.
        """
        await internal_sio.emit(
            "audio_tool_call_start",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_tool_call_progress(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_tool_call_progress event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with incremental arguments, etc.
        """
        await internal_sio.emit(
            "audio_tool_call_progress",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_tool_call_complete(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_tool_call_complete event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with final arguments, etc.
        """
        await internal_sio.emit(
            "audio_tool_call_complete",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_user_audio_link(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_user_audio_link event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with upload_id, item_id, message_id, etc.
        """
        await internal_sio.emit(
            "audio_user_audio_link",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_assistant_audio_link(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_assistant_audio_link event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with upload_id, call_id, message_id, etc.
        """
        await internal_sio.emit(
            "audio_assistant_audio_link",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_session_usage(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_session_usage event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with input_tokens, output_tokens, pricing, etc.
        """
        await internal_sio.emit(
            "audio_session_usage",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_session_interrupt(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_session_interrupt event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with reason, etc.
        """
        await internal_sio.emit(
            "audio_session_interrupt",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )

    async def emit_audio_error(
        self,
        run_id: uuid.UUID,
        event_data: dict[str, Any],
    ) -> None:
        """Emit audio_error event.

        Args:
            run_id: Run ID for the audio session
            event_data: Event payload with error_message, context, etc.
        """
        await internal_sio.emit(
            "audio_error",
            {
                "run_id": str(run_id),
                "event_data": event_data,
            },
        )
