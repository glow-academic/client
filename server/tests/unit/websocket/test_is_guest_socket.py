"""
Tests for app.utils.websocket.is_guest_socket
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.is_guest_socket import is_guest_socket


class TestIs_Guest_Socket:
    """Tests for is_guest_socket function."""

    @pytest.mark.asyncio
    async def test_is_guest_socket_true(self) -> None:
        """Test is_guest_socket returns True when socket is guest."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sismember = AsyncMock(return_value=True)

        with patch(
            "app.utils.websocket.is_guest_socket.get_redis_client",
            return_value=mock_redis,
        ):
            result = await is_guest_socket(socket_id)

            assert result is True
            mock_redis.sismember.assert_called_once_with("guest_sockets", socket_id)

    @pytest.mark.asyncio
    async def test_is_guest_socket_false(self) -> None:
        """Test is_guest_socket returns False when socket is not guest."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sismember = AsyncMock(return_value=False)

        with patch(
            "app.utils.websocket.is_guest_socket.get_redis_client",
            return_value=mock_redis,
        ):
            result = await is_guest_socket(socket_id)

            assert result is False

    @pytest.mark.asyncio
    async def test_is_guest_socket_no_redis(self) -> None:
        """Test is_guest_socket without Redis."""
        socket_id = "socket-123"

        with patch(
            "app.utils.websocket.is_guest_socket.get_redis_client", return_value=None
        ):
            result = await is_guest_socket(socket_id)

            assert result is False

    @pytest.mark.asyncio
    async def test_is_guest_socket_error_handling(self) -> None:
        """Test is_guest_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sismember = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.is_guest_socket.get_redis_client",
            return_value=mock_redis,
        ):
            result = await is_guest_socket(socket_id)

            assert result is False
