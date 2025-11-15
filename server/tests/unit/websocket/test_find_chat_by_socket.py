"""
Tests for app.utils.websocket.find_chat_by_socket
"""

from unittest.mock import AsyncMock, patch

import pytest
from app.utils.websocket.find_chat_by_socket import find_chat_by_socket


class TestFind_Chat_By_Socket:
    """Tests for find_chat_by_socket function."""

    @pytest.mark.asyncio
    async def test_find_chat_by_socket_success(self) -> None:
        """Test finding chat by socket with Redis."""
        socket_id = "socket-123"
        chat_id = "chat-123"
        mock_redis = AsyncMock()

        # Mock scan_iter to return one key
        async def mock_scan_iter(match: str):
            yield f"active_connection:{chat_id}".encode("utf-8")

        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))

        with patch(
            "app.utils.websocket.find_chat_by_socket.get_redis_client", return_value=mock_redis
        ):
            result = await find_chat_by_socket(socket_id)

            assert result == chat_id

    @pytest.mark.asyncio
    async def test_find_chat_by_socket_not_found(self) -> None:
        """Test find_chat_by_socket when chat not found."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()

        # Mock scan_iter to return empty
        async def mock_scan_iter(match: str):
            return
            yield  # Make it an async generator

        mock_redis.scan_iter = mock_scan_iter

        with patch(
            "app.utils.websocket.find_chat_by_socket.get_redis_client", return_value=mock_redis
        ):
            result = await find_chat_by_socket(socket_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_find_chat_by_socket_no_redis(self) -> None:
        """Test find_chat_by_socket without Redis."""
        socket_id = "socket-123"

        with patch(
            "app.utils.websocket.find_chat_by_socket.get_redis_client", return_value=None
        ):
            result = await find_chat_by_socket(socket_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_find_chat_by_socket_error_handling(self) -> None:
        """Test find_chat_by_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.scan_iter = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.find_chat_by_socket.get_redis_client", return_value=mock_redis
        ):
            result = await find_chat_by_socket(socket_id)

            assert result is None

