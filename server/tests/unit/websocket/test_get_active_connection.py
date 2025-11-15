"""
Tests for app.utils.websocket.get_active_connection
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.utils.websocket.get_active_connection import get_active_connection


class TestGet_Active_Connection:
    """Tests for get_active_connection function."""

    @pytest.mark.asyncio
    async def test_get_active_connection_success(self) -> None:
        """Test getting active connection with Redis."""
        chat_id = "chat-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))

        with patch(
            "app.utils.websocket.get_active_connection.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_active_connection(chat_id)

            assert result == socket_id
            mock_redis.get.assert_called_once_with(f"active_connection:{chat_id}")

    @pytest.mark.asyncio
    async def test_get_active_connection_none(self) -> None:
        """Test get_active_connection when connection doesn't exist."""
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        with patch(
            "app.utils.websocket.get_active_connection.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_active_connection(chat_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_get_active_connection_no_redis(self) -> None:
        """Test get_active_connection without Redis."""
        chat_id = "chat-123"

        with patch(
            "app.utils.websocket.get_active_connection.get_redis_client",
            return_value=None,
        ):
            result = await get_active_connection(chat_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_get_active_connection_error_handling(self) -> None:
        """Test get_active_connection error handling."""
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.get_active_connection.get_redis_client",
            return_value=mock_redis,
        ):
            result = await get_active_connection(chat_id)

            assert result is None
