"""
Tests for app.v5.infra.websocket.get_guest_count
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.v5.infra.websocket.get_guest_count import get_guest_count


class TestGet_Guest_Count:
    """Tests for get_guest_count function."""

    @pytest.mark.asyncio
    async def test_get_guest_count_success(self) -> None:
        """Test getting guest count with Redis."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"5")

        with patch(
            "app.v5.infra.websocket.get_guest_count.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_guest_count()

            assert result == 5
            mock_redis.get.assert_called_once_with("guest_connection_count")

    @pytest.mark.asyncio
    async def test_get_guest_count_string_value(self) -> None:
        """Test get_guest_count with string value."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value="10")

        with patch(
            "app.v5.infra.websocket.get_guest_count.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_guest_count()

            assert result == 10

    @pytest.mark.asyncio
    async def test_get_guest_count_none(self) -> None:
        """Test get_guest_count when count is None."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        with patch(
            "app.v5.infra.websocket.get_guest_count.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_get_guest_count_no_redis(self) -> None:
        """Test get_guest_count without Redis."""
        with patch(
            "app.v5.infra.websocket.get_guest_count.get_redis_client", return_value=None
        ):
            result = await get_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_get_guest_count_error_handling(self) -> None:
        """Test get_guest_count error handling."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.v5.infra.websocket.get_guest_count.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_guest_count()

            assert result == 0
