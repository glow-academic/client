"""
Tests for app.utils.websocket.store_active_events
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.utils.websocket.store_active_events import store_active_events


class TestStore_Active_Events:
    """Tests for store_active_events function."""

    @pytest.mark.asyncio
    async def test_store_active_events_success(self) -> None:
        """Test storing active events."""
        # Arrange
        chat_id = "chat-123"
        events_iter = AsyncMock()
        mock_active_results = {}

        # Act
        with patch(
            "app.utils.websocket.store_active_events.get_active_results_dict",
            return_value=mock_active_results,
        ):
            await store_active_events(chat_id, events_iter)

        # Assert
        assert chat_id in mock_active_results
        assert mock_active_results[chat_id]["events"] == events_iter

    @pytest.mark.asyncio
    async def test_store_active_events_existing_entry(self) -> None:
        """Test storing active events when entry already exists."""
        # Arrange
        chat_id = "chat-123"
        events_iter = AsyncMock()
        mock_active_results = {chat_id: {"result": "some_result"}}

        # Act
        with patch(
            "app.utils.websocket.store_active_events.get_active_results_dict",
            return_value=mock_active_results,
        ):
            await store_active_events(chat_id, events_iter)

        # Assert
        assert mock_active_results[chat_id]["events"] == events_iter
        assert mock_active_results[chat_id]["result"] == "some_result"
