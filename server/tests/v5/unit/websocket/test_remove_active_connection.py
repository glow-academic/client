"""
Tests for app.v5.infra.websocket.remove_active_connection
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.v5.infra.websocket.remove_active_connection import remove_active_connection


class TestRemove_Active_Connection:
    """Tests for remove_active_connection function."""

    @pytest.mark.asyncio
    async def test_remove_active_connection_success(self) -> None:
        """Test removing active connection with Redis."""
        chat_id = "chat-123"
        socket_id = "socket-456"
        mock_redis = AsyncMock()
        mock_redis.srem = AsyncMock()
        mock_redis.scard = AsyncMock(return_value=0)
        mock_redis.delete = AsyncMock()

        with patch(
            "app.v5.infra.websocket.remove_active_connection.get_redis_client",
            return_value=mock_redis,
        ):
            await remove_active_connection(chat_id, socket_id)

            mock_redis.srem.assert_called_once_with(
                f"active_connection:{chat_id}", socket_id
            )

    @pytest.mark.asyncio
    async def test_remove_active_connection_no_redis(self) -> None:
        """Test removing active connection without Redis."""
        chat_id = "chat-123"
        socket_id = "socket-456"

        with patch(
            "app.v5.infra.websocket.remove_active_connection.get_redis_client",
            return_value=None,
        ):
            # Should not raise an error
            await remove_active_connection(chat_id, socket_id)

    @pytest.mark.asyncio
    async def test_remove_active_connection_error_handling(self) -> None:
        """Test remove_active_connection error handling."""
        chat_id = "chat-123"
        socket_id = "socket-456"
        mock_redis = AsyncMock()
        mock_redis.srem = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.v5.infra.websocket.remove_active_connection.get_redis_client",
            return_value=mock_redis,
        ):
            # Should not raise an error, just log it
            await remove_active_connection(chat_id, socket_id)
