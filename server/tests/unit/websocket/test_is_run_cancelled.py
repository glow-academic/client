"""
Tests for app.utils.websocket.is_run_cancelled
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.v4.websocket.is_run_cancelled import is_run_cancelled


class TestIs_Run_Cancelled:
    """Tests for is_run_cancelled function."""

    @pytest.mark.asyncio
    async def test_is_run_cancelled_true(self) -> None:
        """Test is_run_cancelled returns True when run is cancelled."""
        # Arrange
        run_id = "run-123"
        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=1)

        # Act
        with patch(
            "app.utils.websocket.is_run_cancelled.get_redis_client",
            return_value=mock_redis,
        ):
            result = await is_run_cancelled(run_id)

        # Assert
        assert result is True
        mock_redis.exists.assert_called_once_with(f"cancel_run:{run_id}")

    @pytest.mark.asyncio
    async def test_is_run_cancelled_false(self) -> None:
        """Test is_run_cancelled returns False when run is not cancelled."""
        # Arrange
        run_id = "run-123"
        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=0)

        # Act
        with patch(
            "app.utils.websocket.is_run_cancelled.get_redis_client",
            return_value=mock_redis,
        ):
            result = await is_run_cancelled(run_id)

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_is_run_cancelled_no_redis(self) -> None:
        """Test is_run_cancelled without Redis."""
        # Arrange
        run_id = "run-123"

        # Act
        with patch(
            "app.utils.websocket.is_run_cancelled.get_redis_client", return_value=None
        ):
            result = await is_run_cancelled(run_id)

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_is_run_cancelled_error_handling(self) -> None:
        """Test is_run_cancelled error handling."""
        # Arrange
        run_id = "run-123"
        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(side_effect=Exception("Redis error"))

        # Act
        with patch(
            "app.utils.websocket.is_run_cancelled.get_redis_client",
            return_value=mock_redis,
        ):
            result = await is_run_cancelled(run_id)

        # Assert
        assert result is False
