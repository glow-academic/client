"""
Tests for app.utils.websocket_emitters
"""

import uuid
from typing import Any

import pytest
from app.utils.websocket.emit_grading_progress import emit_grading_progress
from app.utils.websocket.emit_hint_progress import emit_hint_progress


class TestEmitGradingProgress:
    """Tests for emit_grading_progress function."""

    @pytest.mark.asyncio
    async def test_emit_grading_progress_with_sio_instance(self) -> None:
        """Test emitting grading progress with Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting grading"}

        class MockSIO:
            async def emit(self, event: str, data: dict[str, Any], room: str) -> None:
                self.last_event = event
                self.last_data = data
                self.last_room = room

        sio_instance = MockSIO()
        await emit_grading_progress(event_data, sio_instance, chat_id)

        assert sio_instance.last_event == "simulation_grading_progress"
        assert sio_instance.last_data == event_data
        assert sio_instance.last_room == f"simulation_{chat_id}"

    @pytest.mark.asyncio
    async def test_emit_grading_progress_without_sio_instance(self) -> None:
        """Test emitting grading progress without Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting grading"}

        # Should not raise an error
        await emit_grading_progress(event_data, None, chat_id)


class TestEmitHintProgress:
    """Tests for emit_hint_progress function."""

    @pytest.mark.asyncio
    async def test_emit_hint_progress_with_sio_instance(self) -> None:
        """Test emitting hint progress with Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting hint generation"}

        class MockSIO:
            async def emit(self, event: str, data: dict[str, Any], room: str) -> None:
                self.last_event = event
                self.last_data = data
                self.last_room = room

        sio_instance = MockSIO()
        await emit_hint_progress(event_data, sio_instance, chat_id)

        assert sio_instance.last_event == "hint_generation_progress"
        assert sio_instance.last_data == event_data
        assert sio_instance.last_room == f"simulation_{chat_id}"

    @pytest.mark.asyncio
    async def test_emit_hint_progress_without_sio_instance(self) -> None:
        """Test emitting hint progress without Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting hint generation"}

        # Should not raise an error
        await emit_hint_progress(event_data, None, chat_id)
