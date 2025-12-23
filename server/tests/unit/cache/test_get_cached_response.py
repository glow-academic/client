"""
Tests for app.utils.cache.get_cached_response
"""

from unittest.mock import MagicMock, patch

import pytest

from utils.cache.get_cached_response import get_cached_response


class TestGet_Cached_Response:
    """Tests for get_cached_response function."""

    @pytest.mark.asyncio
    async def test_get_cached_response_success(self) -> None:
        """Test successful get_cached_response execution."""
        cached_data = {"data": {"test": "value"}}

        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/v3/test"

        with patch("app.utils.cache.get_cached_response.get_cached") as mock_get_cached:
            mock_get_cached.return_value = cached_data
            result = await get_cached_response(mock_request, ["tag1"])

            assert result == cached_data

    @pytest.mark.asyncio
    async def test_get_cached_response_post_method(self) -> None:
        """Test get_cached_response with POST method."""
        cached_data = {"data": {"test": "value"}}

        mock_request = MagicMock()
        mock_request.method = "POST"
        mock_request.url.path = "/api/v3/test"

        with patch("app.utils.cache.get_cached_response.get_cached") as mock_get_cached:
            mock_get_cached.return_value = cached_data
            result = await get_cached_response(mock_request, ["tag1"], "user123")

            assert result == cached_data

    @pytest.mark.asyncio
    async def test_get_cached_response_not_found(self) -> None:
        """Test get_cached_response when cache miss."""
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/v3/test"

        with patch("app.utils.cache.get_cached_response.get_cached") as mock_get_cached:
            mock_get_cached.return_value = None
            result = await get_cached_response(mock_request, ["tag1"])

            assert result is None
