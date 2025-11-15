"""
Tests for app.utils.websocket.find_profile_by_socket
"""

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, patch

import pytest

from app.utils.websocket.find_profile_by_socket import find_profile_by_socket


class TestFind_Profile_By_Socket:
    """Tests for find_profile_by_socket function."""

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_success(self) -> None:
        """Test finding profile by socket with Redis."""
        socket_id = "socket-123"
        profile_id = "profile-123"
        mock_redis = AsyncMock()

        # Mock scan_iter to return one key
        async def mock_scan_iter(match: str) -> AsyncIterator[bytes]:
            yield f"socket_owner:{profile_id}".encode()

        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))
        mock_socket_owner = {}

        with (
            patch(
                "app.utils.websocket.find_profile_by_socket.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.find_profile_by_socket.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await find_profile_by_socket(socket_id)

            assert result == profile_id

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_not_found(self) -> None:
        """Test find_profile_by_socket when socket not found."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()

        # Mock scan_iter to return empty
        async def mock_scan_iter(match: str) -> AsyncIterator[bytes]:
            if False:
                yield b""  # pragma: no cover

        mock_redis.scan_iter = mock_scan_iter
        mock_socket_owner = {}

        with (
            patch(
                "app.utils.websocket.find_profile_by_socket.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.find_profile_by_socket.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await find_profile_by_socket(socket_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_no_redis(self) -> None:
        """Test find_profile_by_socket without Redis (fallback)."""
        socket_id = "socket-123"
        profile_id = "profile-123"
        mock_socket_owner = {profile_id: socket_id}

        with (
            patch(
                "app.utils.websocket.find_profile_by_socket.get_redis_client",
                return_value=None,
            ),
            patch(
                "app.utils.websocket.find_profile_by_socket.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await find_profile_by_socket(socket_id)

            assert result == profile_id

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_error_fallback(self) -> None:
        """Test find_profile_by_socket falls back to in-memory on error."""
        socket_id = "socket-123"
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        mock_redis.scan_iter = AsyncMock(side_effect=Exception("Redis error"))
        mock_socket_owner = {profile_id: socket_id}

        with (
            patch(
                "app.utils.websocket.find_profile_by_socket.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.find_profile_by_socket.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await find_profile_by_socket(socket_id)

            assert result == profile_id
