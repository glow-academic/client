"""
Tests for app.utils.websocket.remove_guest_socket
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.utils.websocket.remove_guest_socket import remove_guest_socket


class TestRemove_Guest_Socket:
    """Tests for remove_guest_socket function."""

    @pytest.mark.asyncio
    async def test_remove_guest_socket_success(self) -> None:
        """Test removing guest socket with Redis."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.srem = AsyncMock(return_value=1)

        with patch(
            "app.utils.websocket.remove_guest_socket.get_redis_client",
            return_value=mock_redis,
        ):
            await remove_guest_socket(socket_id)

            mock_redis.srem.assert_called_once_with("guest_sockets", socket_id)

    @pytest.mark.asyncio
    async def test_remove_guest_socket_no_redis(self) -> None:
        """Test removing guest socket without Redis."""
        socket_id = "socket-123"

        with patch(
            "app.utils.websocket.remove_guest_socket.get_redis_client",
            return_value=None,
        ):
            # Should not raise an error
            await remove_guest_socket(socket_id)

    @pytest.mark.asyncio
    async def test_remove_guest_socket_error_handling(self) -> None:
        """Test remove_guest_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.srem = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.remove_guest_socket.get_redis_client",
            return_value=mock_redis,
        ):
            # Should not raise an error, just log it
            await remove_guest_socket(socket_id)
