"""
Tests for app.utils.websocket.remove_active_result
"""

from unittest.mock import patch

import pytest

from app.infra.v3.websocket.remove_active_result import remove_active_result


class TestRemove_Active_Result:
    """Tests for remove_active_result function."""

    @pytest.mark.asyncio
    async def test_remove_active_result_success(self) -> None:
        """Test removing active result."""
        # Arrange
        chat_id = "chat-123"
        mock_active_results = {chat_id: {"result": "some_result"}}

        # Act
        with patch(
            "app.utils.websocket.remove_active_result.get_active_results_dict",
            return_value=mock_active_results,
        ):
            await remove_active_result(chat_id)

        # Assert
        assert chat_id not in mock_active_results

    @pytest.mark.asyncio
    async def test_remove_active_result_not_exists(self) -> None:
        """Test removing active result when it doesn't exist."""
        # Arrange
        chat_id = "chat-123"
        mock_active_results = {}

        # Act
        with patch(
            "app.utils.websocket.remove_active_result.get_active_results_dict",
            return_value=mock_active_results,
        ):
            await remove_active_result(chat_id)

        # Assert
        assert chat_id not in mock_active_results
