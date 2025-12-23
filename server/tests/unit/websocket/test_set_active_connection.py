"""
Tests for app.utils.websocket.set_active_connection
"""

from unittest.mock import AsyncMock, patch

import pytest
from app.infra.v3.websocket.set_active_connection import set_active_connection


class TestSet_Active_Connection:
    """Tests for set_active_connection function."""

    @pytest.mark.asyncio
    async def test_set_active_connection_success(self) -> None:
        """Test setting active connection with Redis."""
        chat_id = "chat-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()

        with patch(
            "app.utils.websocket.set_active_connection.get_redis_client",
            return_value=mock_redis,
        ):
            await set_active_connection(chat_id, socket_id)

            mock_redis.setex.assert_called_once_with(
                f"active_connection:{chat_id}", 3600, socket_id
            )

    @pytest.mark.asyncio
    async def test_set_active_connection_no_redis(self) -> None:
        """Test setting active connection without Redis."""
        chat_id = "chat-123"
        socket_id = "socket-123"

        with patch(
            "app.utils.websocket.set_active_connection.get_redis_client",
            return_value=None,
        ):
            # Should not raise an error
            await set_active_connection(chat_id, socket_id)

    @pytest.mark.asyncio
    async def test_set_active_connection_error_handling(self) -> None:
        """Test set_active_connection error handling."""
        chat_id = "chat-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis error"))

        with patch(
            "app.utils.websocket.set_active_connection.get_redis_client",
            return_value=mock_redis,
        ):
            # Should not raise an error, just log it
            await set_active_connection(chat_id, socket_id)
