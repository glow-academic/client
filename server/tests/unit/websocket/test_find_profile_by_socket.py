"""
Tests for app.infra.v4.websocket.find_profile_by_socket
"""

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, patch

import pytest

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket


class TestFind_Profile_By_Socket:
    """Tests for find_profile_by_socket function."""

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_success(self) -> None:
        """Test finding profile by socket with Redis using direct lookup."""
        socket_id = "socket-123"
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        # Mock direct lookup via reverse index (primary method)
        mock_redis.get = AsyncMock(return_value=profile_id.encode("utf-8"))
        mock_socket_owner = {}

        with (
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await find_profile_by_socket(socket_id)

            assert result == profile_id
            # Verify direct lookup was used (not scan_iter)
            mock_redis.get.assert_called_once_with(f"socket_to_profile:{socket_id}")

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_not_found(self) -> None:
        """Test find_profile_by_socket when socket not found."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        # Mock direct lookup returns None (not found)
        mock_redis.get = AsyncMock(return_value=None)

        # Mock scan_iter to return empty (fallback)
        async def mock_scan_iter(match: str) -> AsyncIterator[bytes]:
            if False:
                yield b""  # pragma: no cover

        mock_redis.scan_iter = mock_scan_iter
        mock_socket_owner = {}

        with (
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await find_profile_by_socket(socket_id)

            assert result is None
            # Verify direct lookup was tried first
            mock_redis.get.assert_called_with(f"socket_to_profile:{socket_id}")

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_no_redis(self) -> None:
        """Test find_profile_by_socket without Redis (fallback)."""
        socket_id = "socket-123"
        profile_id = "profile-123"
        mock_socket_owner = {profile_id: socket_id}

        with (
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_redis_client",
                return_value=None,
            ),
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_socket_owner_dict",
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
        # Mock direct lookup fails, then scan_iter also fails
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))
        mock_socket_owner = {profile_id: socket_id}

        with (
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await find_profile_by_socket(socket_id)

            assert result == profile_id

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_fallback_to_scan_iter(self) -> None:
        """Test find_profile_by_socket falls back to scan_iter when reverse index missing."""
        socket_id = "socket-123"
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        # Mock direct lookup returns None (reverse index missing)
        # Then during scan_iter, get() is called again for forward mapping lookup
        get_calls = []

        async def mock_get(key: str | bytes):
            key_str = key.decode("utf-8") if isinstance(key, bytes) else key
            get_calls.append(key_str)
            if key_str == f"socket_to_profile:{socket_id}":
                # First call: reverse index lookup returns None
                return None
            elif key_str == f"socket_owner:{profile_id}":
                # Second call during scan_iter: forward mapping lookup
                return socket_id.encode("utf-8")
            return None

        mock_redis.get = AsyncMock(side_effect=mock_get)

        # Mock scan_iter to return one key
        async def mock_scan_iter(match: str) -> AsyncIterator[bytes]:
            yield f"socket_owner:{profile_id}".encode()

        mock_redis.scan_iter = mock_scan_iter
        mock_socket_owner = {}

        with (
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.infra.v4.websocket.find_profile_by_socket.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            result = await find_profile_by_socket(socket_id)

            assert result == profile_id
            # Verify direct lookup was tried first, then scan_iter fallback
            assert f"socket_to_profile:{socket_id}" in get_calls
            assert f"socket_owner:{profile_id}" in get_calls
