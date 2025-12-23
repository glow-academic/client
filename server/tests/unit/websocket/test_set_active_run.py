"""
Tests for app.utils.websocket.set_active_run
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.set_active_run import set_active_run


class TestSet_Active_Run:
    """Tests for set_active_run function."""

    @pytest.mark.asyncio
    async def test_set_active_run_success(self) -> None:
        """Test setting active run with Redis."""
        # Arrange
        chat_id = "chat-123"
        run_id = "run-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()

        # Act
        with patch(
            "app.utils.websocket.set_active_run.get_redis_client",
            return_value=mock_redis,
        ):
            await set_active_run(chat_id, run_id)

        # Assert
        mock_redis.setex.assert_called_once_with(f"active_run:{chat_id}", 7200, run_id)

    @pytest.mark.asyncio
    async def test_set_active_run_no_redis(self) -> None:
        """Test setting active run without Redis."""
        # Arrange
        chat_id = "chat-123"
        run_id = "run-123"

        # Act
        with patch(
            "app.utils.websocket.set_active_run.get_redis_client", return_value=None
        ):
            await set_active_run(chat_id, run_id)

        # Assert - should not raise an error

    @pytest.mark.asyncio
    async def test_set_active_run_error_handling(self) -> None:
        """Test set_active_run error handling."""
        # Arrange
        chat_id = "chat-123"
        run_id = "run-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis error"))

        # Act
        with patch(
            "app.utils.websocket.set_active_run.get_redis_client",
            return_value=mock_redis,
        ):
            await set_active_run(chat_id, run_id)

        # Assert - should not raise an error, just log it
