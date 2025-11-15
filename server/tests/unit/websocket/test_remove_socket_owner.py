"""
Tests for app.utils.websocket.remove_socket_owner
"""

from unittest.mock import AsyncMock, patch

import pytest
from app.utils.websocket.remove_socket_owner import remove_socket_owner


class TestRemove_Socket_Owner:
    """Tests for remove_socket_owner function."""

    @pytest.mark.asyncio
    async def test_remove_socket_owner_success(self) -> None:
        """Test removing socket owner with Redis."""
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock()
        mock_socket_owner = {profile_id: "socket-123"}

        with (
            patch(
                "app.utils.websocket.remove_socket_owner.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.remove_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            await remove_socket_owner(profile_id)

            mock_redis.delete.assert_called_once_with(f"socket_owner:{profile_id}")
            # When Redis succeeds, it doesn't remove from in-memory dict (only on error/fallback)
            assert (
                profile_id in mock_socket_owner
            )  # Still in dict because Redis succeeded

    @pytest.mark.asyncio
    async def test_remove_socket_owner_no_redis(self) -> None:
        """Test removing socket owner without Redis (fallback)."""
        profile_id = "profile-123"
        mock_socket_owner = {profile_id: "socket-123"}

        with (
            patch(
                "app.utils.websocket.remove_socket_owner.get_redis_client",
                return_value=None,
            ),
            patch(
                "app.utils.websocket.remove_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            await remove_socket_owner(profile_id)

            assert profile_id not in mock_socket_owner

    @pytest.mark.asyncio
    async def test_remove_socket_owner_error_fallback(self) -> None:
        """Test remove_socket_owner falls back to in-memory on error."""
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock(side_effect=Exception("Redis error"))
        mock_socket_owner = {profile_id: "socket-123"}

        with (
            patch(
                "app.utils.websocket.remove_socket_owner.get_redis_client",
                return_value=mock_redis,
            ),
            patch(
                "app.utils.websocket.remove_socket_owner.get_socket_owner_dict",
                return_value=mock_socket_owner,
            ),
        ):
            await remove_socket_owner(profile_id)

            assert profile_id not in mock_socket_owner
