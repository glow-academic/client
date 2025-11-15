"""
Tests for app.utils.websocket.increment_guest_count
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.utils.websocket.increment_guest_count import increment_guest_count


class TestIncrement_Guest_Count:
    """Tests for increment_guest_count function."""

    @pytest.mark.asyncio
    async def test_increment_guest_count_success(self) -> None:
        """Test incrementing guest count with Redis."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=6)

        with patch(
            "app.utils.websocket.increment_guest_count.get_redis_client",
            return_value=mock_redis,
        ):
            result = await increment_guest_count()

            assert result == 6
            mock_redis.incr.assert_called_once_with("guest_connection_count")

    @pytest.mark.asyncio
    async def test_increment_guest_count_none_result(self) -> None:
        """Test increment_guest_count when result is None."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=None)

        with patch(
            "app.utils.websocket.increment_guest_count.get_redis_client",
            return_value=mock_redis,
        ):
            result = await increment_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_increment_guest_count_no_redis(self) -> None:
        """Test increment_guest_count without Redis."""
        with patch(
            "app.utils.websocket.increment_guest_count.get_redis_client",
            return_value=None,
        ):
            result = await increment_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_increment_guest_count_error_handling(self) -> None:
        """Test increment_guest_count error handling."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.increment_guest_count.get_redis_client",
            return_value=mock_redis,
        ):
            result = await increment_guest_count()

            assert result == 0
