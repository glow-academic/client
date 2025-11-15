"""
Tests for app.utils.websocket.cancel_active_result
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.utils.websocket.cancel_active_result import cancel_active_result


class TestCancel_Active_Result:
    """Tests for cancel_active_result function."""

    @pytest.mark.asyncio
    async def test_cancel_active_result_success(self) -> None:
        """Test cancelling active result successfully."""
        # Arrange
        chat_id = "chat-123"
        mock_result = MagicMock()
        mock_result.cancel = MagicMock(return_value=None)
        mock_events_iter = AsyncMock()
        mock_events_iter.aclose = AsyncMock()
        mock_active_results = {chat_id: {"result": mock_result, "events": mock_events_iter}}

        # Act
        with patch("app.utils.websocket.cancel_active_result.get_active_results_dict", return_value=mock_active_results):
            result = await cancel_active_result(chat_id)

        # Assert
        assert result is True
        mock_result.cancel.assert_called_once()
        mock_events_iter.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_cancel_active_result_async_cancel(self) -> None:
        """Test cancelling active result with async cancel."""
        # Arrange
        chat_id = "chat-123"
        mock_result = MagicMock()
        mock_cancel_coro = AsyncMock()
        mock_result.cancel = MagicMock(return_value=mock_cancel_coro)
        mock_events_iter = AsyncMock()
        mock_events_iter.aclose = AsyncMock()
        mock_active_results = {chat_id: {"result": mock_result, "events": mock_events_iter}}

        # Act
        with patch("app.utils.websocket.cancel_active_result.get_active_results_dict", return_value=mock_active_results):
            result = await cancel_active_result(chat_id)

        # Assert
        assert result is True

    @pytest.mark.asyncio
    async def test_cancel_active_result_no_entry(self) -> None:
        """Test cancelling active result when entry doesn't exist."""
        # Arrange
        chat_id = "chat-123"
        mock_active_results = {}

        # Act
        with patch("app.utils.websocket.cancel_active_result.get_active_results_dict", return_value=mock_active_results):
            result = await cancel_active_result(chat_id)

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_active_result_no_result(self) -> None:
        """Test cancelling active result when result is None."""
        # Arrange
        chat_id = "chat-123"
        mock_events_iter = AsyncMock()
        mock_events_iter.aclose = AsyncMock()
        mock_active_results = {chat_id: {"events": mock_events_iter}}

        # Act
        with patch("app.utils.websocket.cancel_active_result.get_active_results_dict", return_value=mock_active_results):
            result = await cancel_active_result(chat_id)

        # Assert
        assert result is True
        mock_events_iter.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_cancel_active_result_error_handling(self) -> None:
        """Test cancel_active_result error handling."""
        # Arrange
        chat_id = "chat-123"
        mock_result = MagicMock()
        mock_result.cancel = MagicMock(side_effect=Exception("Cancel error"))
        mock_active_results = {chat_id: {"result": mock_result}}

        # Act
        with patch("app.utils.websocket.cancel_active_result.get_active_results_dict", return_value=mock_active_results):
            result = await cancel_active_result(chat_id)

        # Assert
        assert result is False

