"""
Tests for app.v5.infra.websocket.store_active_result
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.v5.infra.websocket.store_active_result import store_active_result


class TestStore_Active_Result:
    """Tests for store_active_result function."""

    @pytest.mark.asyncio
    async def test_store_active_result_success(self) -> None:
        """Test storing active result."""
        # Arrange
        chat_id = "chat-123"
        result = MagicMock()
        mock_active_results = {}

        # Act
        with patch(
            "app.v5.infra.websocket.store_active_result.get_active_results_dict",
            return_value=mock_active_results,
        ):
            await store_active_result(chat_id, result)

        # Assert
        assert chat_id in mock_active_results
        assert mock_active_results[chat_id]["result"] == result

    @pytest.mark.asyncio
    async def test_store_active_result_existing_entry(self) -> None:
        """Test storing active result when entry already exists."""
        # Arrange
        chat_id = "chat-123"
        result = MagicMock()
        mock_active_results = {chat_id: {"events": AsyncMock()}}

        # Act
        with patch(
            "app.v5.infra.websocket.store_active_result.get_active_results_dict",
            return_value=mock_active_results,
        ):
            await store_active_result(chat_id, result)

        # Assert
        assert mock_active_results[chat_id]["result"] == result
        assert "events" in mock_active_results[chat_id]
