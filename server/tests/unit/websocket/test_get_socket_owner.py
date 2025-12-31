"""
Tests for app.utils.websocket.get_socket_owner
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.v4.websocket.get_socket_owner import get_socket_owner


class TestGet_Socket_Owner:
    """Tests for get_socket_owner function."""

    @pytest.mark.asyncio
    async def test_get_socket_owner_success(self) -> None:
        """Test getting socket owner with Redis."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))
        mock_socket_owner = {}

        with (
            patch(
                "app.utils.websocket.get_socket_owner.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.get_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await get_socket_owner(profile_id)

            assert result == socket_id
            mock_redis.get.assert_called_once_with(f"socket_owner:{profile_id}")

    @pytest.mark.asyncio
    async def test_get_socket_owner_none(self) -> None:
        """Test get_socket_owner when owner doesn't exist."""
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_socket_owner = {}

        with (
            patch(
                "app.utils.websocket.get_socket_owner.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.get_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await get_socket_owner(profile_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_get_socket_owner_no_redis(self) -> None:
        """Test get_socket_owner without Redis (fallback)."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_socket_owner = {profile_id: socket_id}

        with (
            patch(
                "app.utils.websocket.get_socket_owner.get_redis_client",
                return_value=None,
            ),
            patch(
                "app.utils.websocket.get_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await get_socket_owner(profile_id)

            assert result == socket_id

    @pytest.mark.asyncio
    async def test_get_socket_owner_error_fallback(self) -> None:
        """Test get_socket_owner falls back to in-memory on error."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))
        mock_socket_owner = {profile_id: socket_id}

        with (
            patch(
                "app.utils.websocket.get_socket_owner.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.get_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await get_socket_owner(profile_id)

            assert result == socket_id
