"""
Tests for app.utils.websocket.find_chats_by_socket
"""

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, patch

import pytest

from app.infra.v3.websocket.find_chats_by_socket import find_chats_by_socket


class TestFind_Chats_By_Socket:
    """Tests for find_chats_by_socket function."""

    @pytest.mark.asyncio
    async def test_find_chats_by_socket_success(self) -> None:
        """Test finding chats by socket with Redis."""
        socket_id = "socket-123"
        chat_ids = ["chat-1", "chat-2"]
        mock_redis = AsyncMock()

        # Mock scan_iter to return multiple keys
        async def mock_scan_iter(match: str) -> AsyncIterator[bytes]:
            for chat_id in chat_ids:
                yield f"active_connection:{chat_id}".encode()

        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))

        with patch(
            "app.utils.websocket.find_chats_by_socket.get_redis_client",
            return_value=mock_redis,
        ):
            result = await find_chats_by_socket(socket_id)

            assert len(result) == 2
            assert chat_ids[0] in result
            assert chat_ids[1] in result

    @pytest.mark.asyncio
    async def test_find_chats_by_socket_empty(self) -> None:
        """Test find_chats_by_socket when no chats found."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()

        # Mock scan_iter to return empty
        async def mock_scan_iter(match: str) -> AsyncIterator[bytes]:
            if False:
                yield b""  # pragma: no cover

        mock_redis.scan_iter = mock_scan_iter

        with patch(
            "app.utils.websocket.find_chats_by_socket.get_redis_client",
            return_value=mock_redis,
        ):
            result = await find_chats_by_socket(socket_id)

            assert result == []

    @pytest.mark.asyncio
    async def test_find_chats_by_socket_no_redis(self) -> None:
        """Test find_chats_by_socket without Redis."""
        socket_id = "socket-123"

        with patch(
            "app.utils.websocket.find_chats_by_socket.get_redis_client",
            return_value=None,
        ):
            result = await find_chats_by_socket(socket_id)

            assert result == []

    @pytest.mark.asyncio
    async def test_find_chats_by_socket_error_handling(self) -> None:
        """Test find_chats_by_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.scan_iter = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.find_chats_by_socket.get_redis_client",
            return_value=mock_redis,
        ):
            result = await find_chats_by_socket(socket_id)

            assert result == []
