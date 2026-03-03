"""
Tests for app.v5.utils.cache.set_cached
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.v5.utils.cache.set_cached import set_cached


class TestSet_Cached:
    """Tests for set_cached function."""

    @pytest.mark.asyncio
    async def test_set_cached_success(self) -> None:
        """Test successful set_cached execution."""
        key = "test_key"
        data = {"data": {"test": "value"}}
        ttl = 60
        tags = ["tag1", "tag2"]

        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
        mock_pipeline.setex = MagicMock(return_value=mock_pipeline)
        mock_pipeline.sadd = MagicMock(return_value=mock_pipeline)
        mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock()

        with patch(
            "app.v5.utils.cache.set_cached.get_redis_client", return_value=mock_redis
        ):
            await set_cached(key, data, ttl, tags)

            mock_redis.pipeline.assert_called_once()
            mock_pipeline.setex.assert_called_once()
            mock_pipeline.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_set_cached_no_redis_client(self) -> None:
        """Test set_cached when redis_client is None."""
        key = "test_key"
        data = {"data": {"test": "value"}}
        ttl = 60
        tags = ["tag1"]

        with patch("app.v5.utils.cache.set_cached.get_redis_client", return_value=None):
            # Should not raise an error
            await set_cached(key, data, ttl, tags)

    @pytest.mark.asyncio
    async def test_set_cached_error_handling(self) -> None:
        """Test set_cached error handling."""
        key = "test_key"
        data = {"data": {"test": "value"}}
        ttl = 60
        tags = ["tag1"]

        mock_redis = AsyncMock()
        mock_redis.pipeline = MagicMock(side_effect=Exception("Redis error"))

        with patch(
            "app.v5.utils.cache.set_cached.get_redis_client", return_value=mock_redis
        ):
            # Should not raise an error, just log it
            await set_cached(key, data, ttl, tags)
