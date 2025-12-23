"""
Tests for app.utils.websocket.get_active_run
"""

from unittest.mock import AsyncMock, patch

import pytest
from app.infra.v3.websocket.get_active_run import get_active_run


class TestGet_Active_Run:
    """Tests for get_active_run function."""

    @pytest.mark.asyncio
    async def test_get_active_run_success(self) -> None:
        """Test getting active run with Redis."""
        # Arrange
        chat_id = "chat-123"
        run_id = "run-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=run_id.encode("utf-8"))

        # Act
        with patch(
            "app.utils.websocket.get_active_run.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_active_run(chat_id)

        # Assert
        assert result == run_id
        mock_redis.get.assert_called_once_with(f"active_run:{chat_id}")

    @pytest.mark.asyncio
    async def test_get_active_run_none(self) -> None:
        """Test get_active_run when run doesn't exist."""
        # Arrange
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        # Act
        with patch(
            "app.utils.websocket.get_active_run.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_active_run(chat_id)

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_active_run_no_redis(self) -> None:
        """Test get_active_run without Redis."""
        # Arrange
        chat_id = "chat-123"

        # Act
        with patch(
            "app.utils.websocket.get_active_run.get_redis_client", return_value=None
        ):
            result = await get_active_run(chat_id)

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_active_run_error_handling(self) -> None:
        """Test get_active_run error handling."""
        # Arrange
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))

        # Act
        with patch(
            "app.utils.websocket.get_active_run.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_active_run(chat_id)

        # Assert
        assert result is None
