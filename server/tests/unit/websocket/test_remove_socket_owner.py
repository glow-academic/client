"""
Tests for app.utils.websocket.remove_socket_owner
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.v4.websocket.remove_socket_owner import remove_socket_owner


class TestRemove_Socket_Owner:
    """Tests for remove_socket_owner function."""

    @pytest.mark.asyncio
    async def test_remove_socket_owner_success(self) -> None:
        """Test removing socket owner with Redis."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))
        mock_pipeline = AsyncMock()
        mock_redis.pipeline = lambda: mock_pipeline
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.delete = AsyncMock()
        mock_pipeline.execute = AsyncMock()
        mock_socket_owner = {profile_id: socket_id}

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

            # Verify socket_id is retrieved first
            mock_redis.get.assert_called_once_with(f"socket_owner:{profile_id}")
            # Verify both keys are deleted: forward and reverse mapping
            assert mock_pipeline.delete.call_count == 2
            mock_pipeline.delete.assert_any_call(f"socket_owner:{profile_id}")
            mock_pipeline.delete.assert_any_call(f"socket_to_profile:{socket_id}")
            mock_pipeline.execute.assert_called_once()
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
