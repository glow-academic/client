"""
Tests for app.utils.cache.get_cached
"""

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.utils.cache.get_cached import get_cached


class TestGet_Cached:
    """Tests for get_cached function."""

    @pytest.mark.asyncio
    async def test_get_cached_success(self) -> None:
        """Test successful get_cached execution."""
        key = "test_key"
        cached_data = {"data": {"test": "value"}}

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=json.dumps(cached_data).encode("utf-8"))

        with patch("app.utils.cache.get_cached.redis_client", mock_redis):
            result = await get_cached(key)

            assert result == cached_data
            mock_redis.get.assert_called_once_with(key)

    @pytest.mark.asyncio
    async def test_get_cached_string_value(self) -> None:
        """Test get_cached with string value (not bytes)."""
        key = "test_key"
        cached_data = {"data": {"test": "value"}}

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=json.dumps(cached_data))

        with patch("app.utils.cache.get_cached.redis_client", mock_redis):
            result = await get_cached(key)

            assert result == cached_data

    @pytest.mark.asyncio
    async def test_get_cached_not_found(self) -> None:
        """Test get_cached when key doesn't exist."""
        key = "nonexistent_key"

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        with patch("app.utils.cache.get_cached.redis_client", mock_redis):
            result = await get_cached(key)

            assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_no_redis_client(self) -> None:
        """Test get_cached when redis_client is None."""
        key = "test_key"

        with patch("app.utils.cache.get_cached.redis_client", None):
            result = await get_cached(key)

            assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_error_handling(self) -> None:
        """Test get_cached error handling."""
        key = "test_key"

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.cache.get_cached.redis_client", mock_redis):
            result = await get_cached(key)

            assert result is None
