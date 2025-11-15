"""
Tests for app.utils.websocket.cancel_active_run
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.utils.websocket.cancel_active_run import cancel_active_run


class TestCancel_Active_Run:
    """Tests for cancel_active_run function."""

    @pytest.mark.asyncio
    async def test_cancel_active_run_success(self) -> None:
        """Test cancelling active run successfully."""
        # Arrange
        chat_id = "chat-123"
        run_id = "run-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()

        # Act
        with (
            patch(
                "app.utils.websocket.cancel_active_run.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.cancel_active_run.get_active_run",
                return_value=run_id,
            ),
        ):
            result = await cancel_active_run(chat_id)

        # Assert
        assert result is True
        mock_redis.setex.assert_called_once_with(f"cancel_run:{run_id}", 300, "1")

    @pytest.mark.asyncio
    async def test_cancel_active_run_no_redis(self) -> None:
        """Test cancelling active run without Redis."""
        # Arrange
        chat_id = "chat-123"

        # Act
        with patch(
            "app.utils.websocket.cancel_active_run.get_redis_client", return_value=None
        ):
            result = await cancel_active_run(chat_id)

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_active_run_no_run_id(self) -> None:
        """Test cancelling active run when run_id doesn't exist."""
        # Arrange
        chat_id = "chat-123"
        mock_redis = AsyncMock()

        # Act
        with (
            patch(
                "app.utils.websocket.cancel_active_run.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.cancel_active_run.get_active_run",
                return_value=None,
            ),
        ):
            result = await cancel_active_run(chat_id)

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_active_run_error_handling(self) -> None:
        """Test cancel_active_run error handling."""
        # Arrange
        chat_id = "chat-123"
        run_id = "run-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis error"))

        # Act
        with (
            patch(
                "app.utils.websocket.cancel_active_run.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.cancel_active_run.get_active_run",
                return_value=run_id,
            ),
        ):
            result = await cancel_active_run(chat_id)

        # Assert
        assert result is False
