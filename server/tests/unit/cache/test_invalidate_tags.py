"""
Tests for app.utils.cache.invalidate_tags
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.utils.cache.invalidate_tags import invalidate_tags


class TestInvalidate_Tags:
    """Tests for invalidate_tags function."""

    @pytest.mark.asyncio
    async def test_invalidate_tags_success(self) -> None:
        """Test successful invalidate_tags execution."""
        tags = ["tag1", "tag2"]
        keys1 = {b"key1", b"key2"}
        keys2 = {b"key3"}

        mock_redis = AsyncMock()
        mock_redis.smembers = AsyncMock(side_effect=[keys1, keys2])
        mock_pipeline = AsyncMock()
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
        mock_pipeline.delete = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock()

        with patch("app.utils.cache.invalidate_tags.redis_client", mock_redis):
            await invalidate_tags(tags)

            mock_redis.pipeline.assert_called_once()
            mock_pipeline.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalidate_tags_no_keys(self) -> None:
        """Test invalidate_tags when no keys exist for tags."""
        tags = ["tag1"]

        mock_redis = AsyncMock()
        mock_redis.smembers = AsyncMock(return_value=set())
        mock_pipeline = AsyncMock()
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
        mock_pipeline.delete = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock()

        with patch("app.utils.cache.invalidate_tags.redis_client", mock_redis):
            await invalidate_tags(tags)

            mock_pipeline.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalidate_tags_no_redis_client(self) -> None:
        """Test invalidate_tags when redis_client is None."""
        tags = ["tag1"]

        with patch("app.utils.cache.invalidate_tags.redis_client", None):
            # Should not raise an error
            await invalidate_tags(tags)

    @pytest.mark.asyncio
    async def test_invalidate_tags_error_handling(self) -> None:
        """Test invalidate_tags error handling."""
        tags = ["tag1"]

        mock_redis = AsyncMock()
        mock_redis.pipeline = MagicMock(side_effect=Exception("Redis error"))

        with patch("app.utils.cache.invalidate_tags.redis_client", mock_redis):
            # Should not raise an error, just log it
            await invalidate_tags(tags)

