"""
Tests for app.utils.cache.set_cached_response
"""

from unittest.mock import MagicMock, patch

import pytest
from utils.cache.set_cached_response import set_cached_response


class TestSet_Cached_Response:
    """Tests for set_cached_response function."""

    @pytest.mark.asyncio
    async def test_set_cached_response_success(self) -> None:
        """Test successful set_cached_response execution."""
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/v3/test"
        data = {"test": "value"}
        tags = ["tag1", "tag2"]
        ttl = 60

        with patch("app.utils.cache.set_cached_response.set_cached") as mock_set_cached:
            mock_set_cached.return_value = None
            await set_cached_response(mock_request, data, tags, ttl)

            mock_set_cached.assert_called_once()

    @pytest.mark.asyncio
    async def test_set_cached_response_post_method(self) -> None:
        """Test set_cached_response with POST method."""
        mock_request = MagicMock()
        mock_request.method = "POST"
        mock_request.url.path = "/api/v3/test"
        data = {"test": "value"}
        tags = ["tag1"]
        ttl = 120

        with patch("app.utils.cache.set_cached_response.set_cached") as mock_set_cached:
            mock_set_cached.return_value = None
            await set_cached_response(mock_request, data, tags, ttl, "user123")

            mock_set_cached.assert_called_once()
