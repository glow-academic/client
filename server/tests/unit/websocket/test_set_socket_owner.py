"""
Tests for app.utils.websocket.set_socket_owner
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.v4.websocket.set_socket_owner import set_socket_owner


class TestSet_Socket_Owner:
    """Tests for set_socket_owner function."""

    @pytest.mark.asyncio
    async def test_set_socket_owner_success(self) -> None:
        """Test setting socket owner with Redis."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()
        mock_socket_owner = {}

        with (
            patch(
                "app.utils.websocket.set_socket_owner.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.set_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            await set_socket_owner(profile_id, socket_id)

            mock_redis.setex.assert_called_once_with(
                f"socket_owner:{profile_id}", 86400, socket_id
            )
            assert profile_id not in mock_socket_owner  # Should not use fallback

    @pytest.mark.asyncio
    async def test_set_socket_owner_no_redis(self) -> None:
        """Test setting socket owner without Redis (fallback)."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_socket_owner = {}

        with (
            patch(
                "app.utils.websocket.set_socket_owner.get_redis_client",
                return_value=None,
            ),
            patch(
                "app.utils.websocket.set_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            await set_socket_owner(profile_id, socket_id)

            assert mock_socket_owner[profile_id] == socket_id

    @pytest.mark.asyncio
    async def test_set_socket_owner_error_fallback(self) -> None:
        """Test set_socket_owner falls back to in-memory on error."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis error"))
        mock_socket_owner = {}

        with (
            patch(
                "app.utils.websocket.set_socket_owner.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.set_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            await set_socket_owner(profile_id, socket_id)

            assert mock_socket_owner[profile_id] == socket_id
