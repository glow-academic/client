"""
Tests for app.utils.websocket.remove_active_run
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.remove_active_run import remove_active_run  # type: ignore


class TestRemove_Active_Run:
    """Tests for remove_active_run function."""

    @pytest.mark.asyncio
    async def test_remove_active_run_success(self) -> None:
        """Test removing active run with Redis."""
        # Arrange
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock()

        # Act
        with patch(
            "app.utils.websocket.remove_active_run.get_redis_client",
            return_value=mock_redis,
        ):
            await remove_active_run(chat_id)

        # Assert
        mock_redis.delete.assert_called_once_with(f"active_run:{chat_id}")

    @pytest.mark.asyncio
    async def test_remove_active_run_no_redis(self) -> None:
        """Test removing active run without Redis."""
        # Arrange
        chat_id = "chat-123"

        # Act
        with patch(
            "app.utils.websocket.remove_active_run.get_redis_client", return_value=None
        ):
            await remove_active_run(chat_id)

        # Assert - should not raise an error

    @pytest.mark.asyncio
    async def test_remove_active_run_error_handling(self) -> None:
        """Test remove_active_run error handling."""
        # Arrange
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock(side_effect=Exception("Redis error"))

        # Act
        with patch(
            "app.utils.websocket.remove_active_run.get_redis_client",
            return_value=mock_redis,
        ):
            await remove_active_run(chat_id)

        # Assert - should not raise an error, just log it
