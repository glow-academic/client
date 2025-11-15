"""
Tests for app.utils.websocket utilities
"""

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.utils.websocket.add_guest_socket import add_guest_socket
from app.utils.websocket.cancel_active_result import cancel_active_result
from app.utils.websocket.cancel_active_run import cancel_active_run
from app.utils.websocket.decrement_guest_count import decrement_guest_count
from app.utils.websocket.emit_chat_stopped import emit_chat_stopped
from app.utils.websocket.emit_grading_progress import emit_grading_progress
from app.utils.websocket.emit_hint_progress import emit_hint_progress
from app.utils.websocket.find_chat_by_socket import find_chat_by_socket
from app.utils.websocket.find_chats_by_socket import find_chats_by_socket
from app.utils.websocket.find_profile_by_socket import find_profile_by_socket
from app.utils.websocket.get_active_connection import get_active_connection
from app.utils.websocket.get_active_run import get_active_run
from app.utils.websocket.get_guest_count import get_guest_count
from app.utils.websocket.get_socket_owner import get_socket_owner
from app.utils.websocket.increment_guest_count import increment_guest_count
from app.utils.websocket.is_guest_socket import is_guest_socket
from app.utils.websocket.is_run_cancelled import is_run_cancelled
from app.utils.websocket.remove_active_connection import \
    remove_active_connection
from app.utils.websocket.remove_active_result import remove_active_result
from app.utils.websocket.remove_active_run import remove_active_run
from app.utils.websocket.remove_guest_socket import remove_guest_socket
from app.utils.websocket.remove_socket_owner import remove_socket_owner
from app.utils.websocket.set_active_connection import set_active_connection
from app.utils.websocket.set_active_run import set_active_run
from app.utils.websocket.set_socket_owner import set_socket_owner
from app.utils.websocket.store_active_events import store_active_events
from app.utils.websocket.store_active_result import store_active_result
from app.utils.websocket.store_active_run import store_active_run


class TestEmitGradingProgress:
    """Tests for emit_grading_progress function."""

    @pytest.mark.asyncio
    async def test_emit_grading_progress_with_sio_instance(self) -> None:
        """Test emitting grading progress with Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting grading"}

        class MockSIO:
            async def emit(self, event: str, data: dict[str, Any], room: str) -> None:
                self.last_event = event
                self.last_data = data
                self.last_room = room

        sio_instance = MockSIO()
        await emit_grading_progress(event_data, sio_instance, chat_id)

        assert sio_instance.last_event == "simulation_grading_progress"
        assert sio_instance.last_data == event_data
        assert sio_instance.last_room == f"simulation_{chat_id}"

    @pytest.mark.asyncio
    async def test_emit_grading_progress_without_sio_instance(self) -> None:
        """Test emitting grading progress without Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting grading"}

        # Should not raise an error
        await emit_grading_progress(event_data, None, chat_id)


class TestEmitHintProgress:
    """Tests for emit_hint_progress function."""

    @pytest.mark.asyncio
    async def test_emit_hint_progress_with_sio_instance(self) -> None:
        """Test emitting hint progress with Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting hint generation"}

        class MockSIO:
            async def emit(self, event: str, data: dict[str, Any], room: str) -> None:
                self.last_event = event
                self.last_data = data
                self.last_room = room

        sio_instance = MockSIO()
        await emit_hint_progress(event_data, sio_instance, chat_id)

        assert sio_instance.last_event == "hint_generation_progress"
        assert sio_instance.last_data == event_data
        assert sio_instance.last_room == f"simulation_{chat_id}"

    @pytest.mark.asyncio
    async def test_emit_hint_progress_without_sio_instance(self) -> None:
        """Test emitting hint progress without Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting hint generation"}

        # Should not raise an error
        await emit_hint_progress(event_data, None, chat_id)


class TestAdd_Guest_Socket:
    """Tests for add_guest_socket function."""

    @pytest.mark.asyncio
    async def test_add_guest_socket_success(self) -> None:
        """Test adding guest socket with Redis."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sadd = AsyncMock(return_value=1)

        with patch("app.utils.websocket.add_guest_socket.get_redis_client", return_value=mock_redis):
            await add_guest_socket(socket_id)

            mock_redis.sadd.assert_called_once_with("guest_sockets", socket_id)

    @pytest.mark.asyncio
    async def test_add_guest_socket_no_redis(self) -> None:
        """Test adding guest socket without Redis."""
        socket_id = "socket-123"

        with patch("app.utils.websocket.add_guest_socket.get_redis_client", return_value=None):
            # Should not raise an error
            await add_guest_socket(socket_id)

    @pytest.mark.asyncio
    async def test_add_guest_socket_error_handling(self) -> None:
        """Test add_guest_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sadd = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.add_guest_socket.get_redis_client", return_value=mock_redis):
            # Should not raise an error, just log it
            await add_guest_socket(socket_id)


class TestRemove_Guest_Socket:
    """Tests for remove_guest_socket function."""

    @pytest.mark.asyncio
    async def test_remove_guest_socket_success(self) -> None:
        """Test removing guest socket with Redis."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.srem = AsyncMock(return_value=1)

        with patch("app.utils.websocket.remove_guest_socket.get_redis_client", return_value=mock_redis):
            await remove_guest_socket(socket_id)

            mock_redis.srem.assert_called_once_with("guest_sockets", socket_id)

    @pytest.mark.asyncio
    async def test_remove_guest_socket_no_redis(self) -> None:
        """Test removing guest socket without Redis."""
        socket_id = "socket-123"

        with patch("app.utils.websocket.remove_guest_socket.get_redis_client", return_value=None):
            # Should not raise an error
            await remove_guest_socket(socket_id)

    @pytest.mark.asyncio
    async def test_remove_guest_socket_error_handling(self) -> None:
        """Test remove_guest_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.srem = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.remove_guest_socket.get_redis_client", return_value=mock_redis):
            # Should not raise an error, just log it
            await remove_guest_socket(socket_id)


class TestIs_Guest_Socket:
    """Tests for is_guest_socket function."""

    @pytest.mark.asyncio
    async def test_is_guest_socket_true(self) -> None:
        """Test is_guest_socket returns True when socket is guest."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sismember = AsyncMock(return_value=True)

        with patch("app.utils.websocket.is_guest_socket.get_redis_client", return_value=mock_redis):
            result = await is_guest_socket(socket_id)

            assert result is True
            mock_redis.sismember.assert_called_once_with("guest_sockets", socket_id)

    @pytest.mark.asyncio
    async def test_is_guest_socket_false(self) -> None:
        """Test is_guest_socket returns False when socket is not guest."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sismember = AsyncMock(return_value=False)

        with patch("app.utils.websocket.is_guest_socket.get_redis_client", return_value=mock_redis):
            result = await is_guest_socket(socket_id)

            assert result is False

    @pytest.mark.asyncio
    async def test_is_guest_socket_no_redis(self) -> None:
        """Test is_guest_socket without Redis."""
        socket_id = "socket-123"

        with patch("app.utils.websocket.is_guest_socket.get_redis_client", return_value=None):
            result = await is_guest_socket(socket_id)

            assert result is False

    @pytest.mark.asyncio
    async def test_is_guest_socket_error_handling(self) -> None:
        """Test is_guest_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.sismember = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.is_guest_socket.get_redis_client", return_value=mock_redis):
            result = await is_guest_socket(socket_id)

            assert result is False


class TestGet_Guest_Count:
    """Tests for get_guest_count function."""

    @pytest.mark.asyncio
    async def test_get_guest_count_success(self) -> None:
        """Test getting guest count with Redis."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"5")

        with patch("app.utils.websocket.get_guest_count.get_redis_client", return_value=mock_redis):
            result = await get_guest_count()

            assert result == 5
            mock_redis.get.assert_called_once_with("guest_connection_count")

    @pytest.mark.asyncio
    async def test_get_guest_count_string_value(self) -> None:
        """Test get_guest_count with string value."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value="10")

        with patch("app.utils.websocket.get_guest_count.get_redis_client", return_value=mock_redis):
            result = await get_guest_count()

            assert result == 10

    @pytest.mark.asyncio
    async def test_get_guest_count_none(self) -> None:
        """Test get_guest_count when count is None."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        with patch("app.utils.websocket.get_guest_count.get_redis_client", return_value=mock_redis):
            result = await get_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_get_guest_count_no_redis(self) -> None:
        """Test get_guest_count without Redis."""
        with patch("app.utils.websocket.get_guest_count.get_redis_client", return_value=None):
            result = await get_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_get_guest_count_error_handling(self) -> None:
        """Test get_guest_count error handling."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.get_guest_count.get_redis_client", return_value=mock_redis):
            result = await get_guest_count()

            assert result == 0


class TestIncrement_Guest_Count:
    """Tests for increment_guest_count function."""

    @pytest.mark.asyncio
    async def test_increment_guest_count_success(self) -> None:
        """Test incrementing guest count with Redis."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=6)

        with patch("app.utils.websocket.increment_guest_count.get_redis_client", return_value=mock_redis):
            result = await increment_guest_count()

            assert result == 6
            mock_redis.incr.assert_called_once_with("guest_connection_count")

    @pytest.mark.asyncio
    async def test_increment_guest_count_none_result(self) -> None:
        """Test increment_guest_count when result is None."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=None)

        with patch("app.utils.websocket.increment_guest_count.get_redis_client", return_value=mock_redis):
            result = await increment_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_increment_guest_count_no_redis(self) -> None:
        """Test increment_guest_count without Redis."""
        with patch("app.utils.websocket.increment_guest_count.get_redis_client", return_value=None):
            result = await increment_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_increment_guest_count_error_handling(self) -> None:
        """Test increment_guest_count error handling."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.increment_guest_count.get_redis_client", return_value=mock_redis):
            result = await increment_guest_count()

            assert result == 0


class TestDecrement_Guest_Count:
    """Tests for decrement_guest_count function."""

    @pytest.mark.asyncio
    async def test_decrement_guest_count_success(self) -> None:
        """Test decrementing guest count with Redis."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"5")
        mock_redis.decr = AsyncMock(return_value=4)
        mock_redis.set = AsyncMock()

        with patch("app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis):
            result = await decrement_guest_count()

            assert result == 4
            mock_redis.decr.assert_called_once_with("guest_connection_count")

    @pytest.mark.asyncio
    async def test_decrement_guest_count_floor_at_zero(self) -> None:
        """Test decrement_guest_count floors at zero."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"0")
        mock_redis.set = AsyncMock()

        with patch("app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis):
            result = await decrement_guest_count()

            assert result == 0
            mock_redis.set.assert_called_once_with("guest_connection_count", 0)
            mock_redis.decr.assert_not_called()

    @pytest.mark.asyncio
    async def test_decrement_guest_count_negative_current(self) -> None:
        """Test decrement_guest_count when current count is negative."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"-1")
        mock_redis.set = AsyncMock()

        with patch("app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis):
            result = await decrement_guest_count()

            assert result == 0
            mock_redis.set.assert_called_once_with("guest_connection_count", 0)

    @pytest.mark.asyncio
    async def test_decrement_guest_count_none_current(self) -> None:
        """Test decrement_guest_count when current count is None."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.set = AsyncMock()

        with patch("app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis):
            result = await decrement_guest_count()

            assert result == 0
            mock_redis.set.assert_called_once_with("guest_connection_count", 0)

    @pytest.mark.asyncio
    async def test_decrement_guest_count_no_redis(self) -> None:
        """Test decrement_guest_count without Redis."""
        with patch("app.utils.websocket.decrement_guest_count.get_redis_client", return_value=None):
            result = await decrement_guest_count()

            assert result == 0

    @pytest.mark.asyncio
    async def test_decrement_guest_count_error_handling(self) -> None:
        """Test decrement_guest_count error handling."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.decrement_guest_count.get_redis_client", return_value=mock_redis):
            result = await decrement_guest_count()

            assert result == 0


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

        with patch("app.utils.websocket.set_socket_owner.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.set_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
            await set_socket_owner(profile_id, socket_id)

            mock_redis.setex.assert_called_once_with(f"socket_owner:{profile_id}", 86400, socket_id)
            assert profile_id not in mock_socket_owner  # Should not use fallback

    @pytest.mark.asyncio
    async def test_set_socket_owner_no_redis(self) -> None:
        """Test setting socket owner without Redis (fallback)."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_socket_owner = {}

        with patch("app.utils.websocket.set_socket_owner.get_redis_client", return_value=None), \
             patch("app.utils.websocket.set_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
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

        with patch("app.utils.websocket.set_socket_owner.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.set_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
            await set_socket_owner(profile_id, socket_id)

            assert mock_socket_owner[profile_id] == socket_id


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

        with patch("app.utils.websocket.get_socket_owner.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.get_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
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

        with patch("app.utils.websocket.get_socket_owner.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.get_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
            result = await get_socket_owner(profile_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_get_socket_owner_no_redis(self) -> None:
        """Test get_socket_owner without Redis (fallback)."""
        profile_id = "profile-123"
        socket_id = "socket-123"
        mock_socket_owner = {profile_id: socket_id}

        with patch("app.utils.websocket.get_socket_owner.get_redis_client", return_value=None), \
             patch("app.utils.websocket.get_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
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

        with patch("app.utils.websocket.get_socket_owner.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.get_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
            result = await get_socket_owner(profile_id)

            assert result == socket_id


class TestRemove_Socket_Owner:
    """Tests for remove_socket_owner function."""

    @pytest.mark.asyncio
    async def test_remove_socket_owner_success(self) -> None:
        """Test removing socket owner with Redis."""
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock()
        mock_socket_owner = {profile_id: "socket-123"}

        with patch("app.utils.websocket.remove_socket_owner.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.remove_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
            await remove_socket_owner(profile_id)

            mock_redis.delete.assert_called_once_with(f"socket_owner:{profile_id}")
            # When Redis succeeds, it doesn't remove from in-memory dict (only on error/fallback)
            assert profile_id in mock_socket_owner  # Still in dict because Redis succeeded

    @pytest.mark.asyncio
    async def test_remove_socket_owner_no_redis(self) -> None:
        """Test removing socket owner without Redis (fallback)."""
        profile_id = "profile-123"
        mock_socket_owner = {profile_id: "socket-123"}

        with patch("app.utils.websocket.remove_socket_owner.get_redis_client", return_value=None), \
             patch("app.utils.websocket.remove_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
            await remove_socket_owner(profile_id)

            assert profile_id not in mock_socket_owner

    @pytest.mark.asyncio
    async def test_remove_socket_owner_error_fallback(self) -> None:
        """Test remove_socket_owner falls back to in-memory on error."""
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock(side_effect=Exception("Redis error"))
        mock_socket_owner = {profile_id: "socket-123"}

        with patch("app.utils.websocket.remove_socket_owner.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.remove_socket_owner.get_socket_owner_dict", return_value=mock_socket_owner):
            await remove_socket_owner(profile_id)

            assert profile_id not in mock_socket_owner


class TestFind_Profile_By_Socket:
    """Tests for find_profile_by_socket function."""

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_success(self) -> None:
        """Test finding profile by socket with Redis."""
        socket_id = "socket-123"
        profile_id = "profile-123"
        mock_redis = AsyncMock()
        
        # Mock scan_iter to return one key
        async def mock_scan_iter(match: str):
            yield f"socket_owner:{profile_id}".encode("utf-8")
        
        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))
        mock_socket_owner = {}

        with patch("app.utils.websocket.find_profile_by_socket.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.find_profile_by_socket.get_socket_owner_dict", return_value=mock_socket_owner):
            result = await find_profile_by_socket(socket_id)

            assert result == profile_id

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_not_found(self) -> None:
        """Test find_profile_by_socket when socket not found."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        
        # Mock scan_iter to return empty
        async def mock_scan_iter(match: str):
            return
            yield  # Make it an async generator
        
        mock_redis.scan_iter = mock_scan_iter
        mock_socket_owner = {}

        with patch("app.utils.websocket.find_profile_by_socket.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.find_profile_by_socket.get_socket_owner_dict", return_value=mock_socket_owner):
            result = await find_profile_by_socket(socket_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_find_profile_by_socket_no_redis(self) -> None:
        """Test find_profile_by_socket without Redis (fallback)."""
        socket_id = "socket-123"
        profile_id = "profile-123"
        mock_socket_owner = {profile_id: socket_id}

        with patch("app.utils.websocket.find_profile_by_socket.get_redis_client", return_value=None), \
             patch("app.utils.websocket.find_profile_by_socket.get_socket_owner_dict", return_value=mock_socket_owner):
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

        with patch("app.utils.websocket.find_profile_by_socket.get_redis_client", return_value=mock_redis), \
             patch("app.utils.websocket.find_profile_by_socket.get_socket_owner_dict", return_value=mock_socket_owner):
            result = await find_profile_by_socket(socket_id)

            assert result == profile_id


class TestSet_Active_Connection:
    """Tests for set_active_connection function."""

    @pytest.mark.asyncio
    async def test_set_active_connection_success(self) -> None:
        """Test setting active connection with Redis."""
        chat_id = "chat-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()

        with patch("app.utils.websocket.set_active_connection.get_redis_client", return_value=mock_redis):
            await set_active_connection(chat_id, socket_id)

            mock_redis.setex.assert_called_once_with(f"active_connection:{chat_id}", 3600, socket_id)

    @pytest.mark.asyncio
    async def test_set_active_connection_no_redis(self) -> None:
        """Test setting active connection without Redis."""
        chat_id = "chat-123"
        socket_id = "socket-123"

        with patch("app.utils.websocket.set_active_connection.get_redis_client", return_value=None):
            # Should not raise an error
            await set_active_connection(chat_id, socket_id)

    @pytest.mark.asyncio
    async def test_set_active_connection_error_handling(self) -> None:
        """Test set_active_connection error handling."""
        chat_id = "chat-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.set_active_connection.get_redis_client", return_value=mock_redis):
            # Should not raise an error, just log it
            await set_active_connection(chat_id, socket_id)


class TestGet_Active_Connection:
    """Tests for get_active_connection function."""

    @pytest.mark.asyncio
    async def test_get_active_connection_success(self) -> None:
        """Test getting active connection with Redis."""
        chat_id = "chat-123"
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))

        with patch("app.utils.websocket.get_active_connection.get_redis_client", return_value=mock_redis):
            result = await get_active_connection(chat_id)

            assert result == socket_id
            mock_redis.get.assert_called_once_with(f"active_connection:{chat_id}")

    @pytest.mark.asyncio
    async def test_get_active_connection_none(self) -> None:
        """Test get_active_connection when connection doesn't exist."""
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        with patch("app.utils.websocket.get_active_connection.get_redis_client", return_value=mock_redis):
            result = await get_active_connection(chat_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_get_active_connection_no_redis(self) -> None:
        """Test get_active_connection without Redis."""
        chat_id = "chat-123"

        with patch("app.utils.websocket.get_active_connection.get_redis_client", return_value=None):
            result = await get_active_connection(chat_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_get_active_connection_error_handling(self) -> None:
        """Test get_active_connection error handling."""
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.get_active_connection.get_redis_client", return_value=mock_redis):
            result = await get_active_connection(chat_id)

            assert result is None


class TestRemove_Active_Connection:
    """Tests for remove_active_connection function."""

    @pytest.mark.asyncio
    async def test_remove_active_connection_success(self) -> None:
        """Test removing active connection with Redis."""
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock()

        with patch("app.utils.websocket.remove_active_connection.get_redis_client", return_value=mock_redis):
            await remove_active_connection(chat_id)

            mock_redis.delete.assert_called_once_with(f"active_connection:{chat_id}")

    @pytest.mark.asyncio
    async def test_remove_active_connection_no_redis(self) -> None:
        """Test removing active connection without Redis."""
        chat_id = "chat-123"

        with patch("app.utils.websocket.remove_active_connection.get_redis_client", return_value=None):
            # Should not raise an error
            await remove_active_connection(chat_id)

    @pytest.mark.asyncio
    async def test_remove_active_connection_error_handling(self) -> None:
        """Test remove_active_connection error handling."""
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.remove_active_connection.get_redis_client", return_value=mock_redis):
            # Should not raise an error, just log it
            await remove_active_connection(chat_id)


class TestFind_Chat_By_Socket:
    """Tests for find_chat_by_socket function."""

    @pytest.mark.asyncio
    async def test_find_chat_by_socket_success(self) -> None:
        """Test finding chat by socket with Redis."""
        socket_id = "socket-123"
        chat_id = "chat-123"
        mock_redis = AsyncMock()
        
        # Mock scan_iter to return one key
        async def mock_scan_iter(match: str):
            yield f"active_connection:{chat_id}".encode("utf-8")
        
        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))

        with patch("app.utils.websocket.find_chat_by_socket.get_redis_client", return_value=mock_redis):
            result = await find_chat_by_socket(socket_id)

            assert result == chat_id

    @pytest.mark.asyncio
    async def test_find_chat_by_socket_not_found(self) -> None:
        """Test find_chat_by_socket when chat not found."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        
        # Mock scan_iter to return empty
        async def mock_scan_iter(match: str):
            return
            yield  # Make it an async generator
        
        mock_redis.scan_iter = mock_scan_iter

        with patch("app.utils.websocket.find_chat_by_socket.get_redis_client", return_value=mock_redis):
            result = await find_chat_by_socket(socket_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_find_chat_by_socket_no_redis(self) -> None:
        """Test find_chat_by_socket without Redis."""
        socket_id = "socket-123"

        with patch("app.utils.websocket.find_chat_by_socket.get_redis_client", return_value=None):
            result = await find_chat_by_socket(socket_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_find_chat_by_socket_error_handling(self) -> None:
        """Test find_chat_by_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.scan_iter = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.find_chat_by_socket.get_redis_client", return_value=mock_redis):
            result = await find_chat_by_socket(socket_id)

            assert result is None


class TestFind_Chats_By_Socket:
    """Tests for find_chats_by_socket function."""

    @pytest.mark.asyncio
    async def test_find_chats_by_socket_success(self) -> None:
        """Test finding chats by socket with Redis."""
        socket_id = "socket-123"
        chat_ids = ["chat-1", "chat-2"]
        mock_redis = AsyncMock()
        
        # Mock scan_iter to return multiple keys
        async def mock_scan_iter(match: str):
            for chat_id in chat_ids:
                yield f"active_connection:{chat_id}".encode("utf-8")
        
        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get = AsyncMock(return_value=socket_id.encode("utf-8"))

        with patch("app.utils.websocket.find_chats_by_socket.get_redis_client", return_value=mock_redis):
            result = await find_chats_by_socket(socket_id)

            assert len(result) == 2
            assert chat_ids[0] in result
            assert chat_ids[1] in result

    @pytest.mark.asyncio
    async def test_find_chats_by_socket_empty(self) -> None:
        """Test find_chats_by_socket when no chats found."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        
        # Mock scan_iter to return empty
        async def mock_scan_iter(match: str):
            return
            yield  # Make it an async generator
        
        mock_redis.scan_iter = mock_scan_iter

        with patch("app.utils.websocket.find_chats_by_socket.get_redis_client", return_value=mock_redis):
            result = await find_chats_by_socket(socket_id)

            assert result == []

    @pytest.mark.asyncio
    async def test_find_chats_by_socket_no_redis(self) -> None:
        """Test find_chats_by_socket without Redis."""
        socket_id = "socket-123"

        with patch("app.utils.websocket.find_chats_by_socket.get_redis_client", return_value=None):
            result = await find_chats_by_socket(socket_id)

            assert result == []

    @pytest.mark.asyncio
    async def test_find_chats_by_socket_error_handling(self) -> None:
        """Test find_chats_by_socket error handling."""
        socket_id = "socket-123"
        mock_redis = AsyncMock()
        mock_redis.scan_iter = AsyncMock(side_effect=Exception("Redis error"))

        with patch("app.utils.websocket.find_chats_by_socket.get_redis_client", return_value=mock_redis):
            result = await find_chats_by_socket(socket_id)

            assert result == []
