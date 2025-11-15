"""
Tests for app.utils.websocket.decrement_guest_count
"""

from unittest.mock import AsyncMock, patch

import pytest
from app.utils.websocket.decrement_guest_count import decrement_guest_count


class TestDecrement_Guest_Count:
    """Tests for decrement_guest_count function."""

    @pytest.mark.asyncio
    async def test_decrement_guest_count_success(self) -> None:
        """Test decrementing guest count with Redis."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"5")
        mock_redis.decr = AsyncMock(return_value=4)
        mock_redis.set = AsyncMock()

        with patch(
            "app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis
        ):
            result = await decrement_guest_count()

            assert result == 4
            mock_redis.decr.assert_called_once_with("guest_connection_count")

    @pytest.mark.asyncio
    async def test_decrement_guest_count_floor_at_zero(self) -> None:
        """Test decrement_guest_count floors at zero."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"0")
        mock_redis.set = AsyncMock()

        with patch(
            "app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis
        ):
            result = await decrement_guest_count()

            assert result == 0
            mock_redis.set.assert_called_once_with("guest_connection_count", 0)
            mock_redis.decr.assert_not_called()

    @pytest.mark.asyncio
    async def test_decrement_guest_count_negative_current(self) -> None:
        """Test decrement_guest_count when current count is negative."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"-1")
        mock_redis.set = AsyncMock()

        with patch(
            "app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis
        ):
            result = await decrement_guest_count()

            assert result == 0
            mock_redis.set.assert_called_once_with("guest_connection_count", 0)

    @pytest.mark.asyncio
    async def test_decrement_guest_count_none_current(self) -> None:
        """Test decrement_guest_count when current count is None."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.set = AsyncMock()

        with patch(
            "app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis
        ):
            result = await decrement_guest_count()

            assert result == 0
            mock_redis.set.assert_called_once_with("guest_connection_count", 0)

    @pytest.mark.asyncio
    async def test_decrement_guest_count_no_redis(self) -> None:
        """Test decrement_guest_count without Redis."""
        with patch(
            "app.utils.websocket.decrement_guest_count.get_redis_client", return_value=None
        ):
            result = await decrement_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_decrement_guest_count_error_handling(self) -> None:
        """Test decrement_guest_count error handling."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis
        ):
            result = await decrement_guest_count()

            assert result == 0

