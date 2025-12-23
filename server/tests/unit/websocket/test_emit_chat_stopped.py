"""
Tests for app.utils.websocket.emit_chat_stopped
"""

from typing import Any
from unittest.mock import patch

import pytest
from app.infra.v3.websocket.emit_chat_stopped import emit_chat_stopped


class TestEmit_Chat_Stopped:
    """Tests for emit_chat_stopped function."""

    @pytest.mark.asyncio
    async def test_emit_chat_stopped_success(self) -> None:
        """Test emitting chat_stopped event."""
        # Arrange
        chat_id = "chat-123"
        chat_type = "simulation"
        message = "Chat stopped successfully"

        class MockSIO:
            async def emit(self, event: str, data: dict[str, Any], room: str) -> None:
                self.last_event = event
                self.last_data = data
                self.last_room = room

        mock_sio = MockSIO()

        # Act
        with patch(
            "app.utils.websocket.emit_chat_stopped.get_sio_instance",
            return_value=mock_sio,
        ):
            await emit_chat_stopped(chat_id, chat_type, message)

        # Assert
        assert mock_sio.last_event == "chat_stopped"
        assert mock_sio.last_data == {
            "chat_id": chat_id,
            "chat_type": chat_type,
            "message": message,
        }
        assert mock_sio.last_room == f"{chat_type}_{chat_id}"

    @pytest.mark.asyncio
    async def test_emit_chat_stopped_default_message(self) -> None:
        """Test emitting chat_stopped event with default message."""
        # Arrange
        chat_id = "chat-123"
        chat_type = "simulation"

        class MockSIO:
            async def emit(self, event: str, data: dict[str, Any], room: str) -> None:
                self.last_data = data

        mock_sio = MockSIO()

        # Act
        with patch(
            "app.utils.websocket.emit_chat_stopped.get_sio_instance",
            return_value=mock_sio,
        ):
            await emit_chat_stopped(chat_id, chat_type)

        # Assert
        assert mock_sio.last_data["message"] == "Chat stopped successfully"
