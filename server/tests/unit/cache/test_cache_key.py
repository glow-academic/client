"""
Tests for app.utils.cache.cache_key
"""

from app.utils.cache.cache_key import cache_key


class TestCache_Key:
    """Tests for cache_key function."""

    def test_cache_key_success(self) -> None:
        """Test successful cache_key generation."""
        path = "/api/v3/test"
        body = {"key": "value"}
        user_ctx = "user123"

        result = cache_key(path, body, user_ctx)

        assert isinstance(result, str)
        assert result.startswith("http:cache:")
        assert len(result) > len("http:cache:")

    def test_cache_key_without_body(self) -> None:
        """Test cache_key generation without body."""
        path = "/api/v3/test"
        result = cache_key(path)

        assert isinstance(result, str)
        assert result.startswith("http:cache:")

    def test_cache_key_without_user_ctx(self) -> None:
        """Test cache_key generation without user context."""
        path = "/api/v3/test"
        body = {"key": "value"}
        result = cache_key(path, body)

        assert isinstance(result, str)
        assert result.startswith("http:cache:")

    def test_cache_key_deterministic(self) -> None:
        """Test that cache_key is deterministic."""
        path = "/api/v3/test"
        body = {"key": "value"}
        user_ctx = "user123"

        result1 = cache_key(path, body, user_ctx)
        result2 = cache_key(path, body, user_ctx)

        assert result1 == result2
