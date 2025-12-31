"""
Tests for app.utils.websocket.add_guest_socket
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.v4.websocket.add_guest_socket import add_guest_socket


class TestAdd_Guest_Socket:
    """Tests for add_guest_socket function."""

    @pytest.mark.asyncio
    async def test_add_guest_socket_success(self) -> None:
        """Test adding guest socket with Redis."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sadd = AsyncMock(return_value=1)

        with patch(
            "app.utils.websocket.add_guest_socket.get_redis_client",
            return_value=mock_redis,
        ):
            await add_guest_socket(socket_id)

            mock_redis.sadd.assert_called_once_with("guest_sockets", socket_id)

    @pytest.mark.asyncio
    async def test_add_guest_socket_no_redis(self) -> None:
        """Test adding guest socket without Redis."""
        socket_id = "socket-123"

        with patch(
            "app.utils.websocket.add_guest_socket.get_redis_client", return_value=None
        ):
            # Should not raise an error
            await add_guest_socket(socket_id)

    @pytest.mark.asyncio
    async def test_add_guest_socket_error_handling(self) -> None:
        """Test add_guest_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sadd = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.add_guest_socket.get_redis_client",
            return_value=mock_redis,
        ):
            # Should not raise an error, just log it
            await add_guest_socket(socket_id)
