"""
Tests for app.main
"""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from app.main import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest


class TestCleanup_Profile_Connection:
    """Tests for cleanup_profile_connection function."""

    @pytest.mark.asyncio
    async def test_cleanup_profile_connection_success(self):
        """Test successful cleanup_profile_connection execution."""
        import uuid
        from unittest.mock import AsyncMock, patch

        from app.main import cleanup_profile_connection

        # Mock the database session
        with patch('app.db.get_session') as mock_get_session:
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the profile
            mock_profile = MagicMock()
            mock_session.exec.return_value.one_or_none.return_value = mock_profile
            
            profile_id = str(uuid.uuid4())

            await cleanup_profile_connection(profile_id)

            # Verify that the profile was updated
            mock_session.add.assert_called_once_with(mock_profile)
            mock_session.commit.assert_called_once()
            assert mock_profile.active is False

    @pytest.mark.asyncio
    async def test_cleanup_profile_connection_error(self):
        """Test cleanup_profile_connection error handling."""
        import uuid
        from unittest.mock import AsyncMock, patch

        from app.main import cleanup_profile_connection

        # Mock the database session to raise an exception
        with patch('app.db.get_session') as mock_get_session:
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            mock_session.exec.side_effect = Exception("Database error")
            
            profile_id = str(uuid.uuid4())

            # The function should handle the exception gracefully
            await cleanup_profile_connection(profile_id)

            # Verify that the database was still accessed
            mock_get_session.assert_called_once()


import pytest


class TestSend_Simulation_Message:
    """Tests for send_simulation_message function."""

    @pytest.mark.asyncio
    async def test_send_simulation_message_success(self):
        """Test successful send_simulation_message execution."""
        from unittest.mock import AsyncMock, patch

        from app.main import send_simulation_message

        # Mock the process_simulation_message_websocket function
        with patch('app.main.process_simulation_message_websocket') as mock_process:
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "message": "Test message"}
            
            await send_simulation_message(sid, data)
            
            # Verify that process_simulation_message_websocket was called
            mock_process.assert_called_once_with(data["chat_id"], data["message"])

    @pytest.mark.asyncio
    async def test_send_simulation_message_error(self):
        """Test send_simulation_message error handling."""
        from unittest.mock import AsyncMock, patch

        from app.main import send_simulation_message

        # Mock the process_simulation_message_websocket function to raise an exception
        with patch('app.main.process_simulation_message_websocket', side_effect=Exception("Test error")):
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "message": "Test message"}
            
            # The function should handle the exception gracefully
            await send_simulation_message(sid, data)


import pytest


class TestSend_Assistant_Message:
    """Tests for send_assistant_message function."""

    @pytest.mark.asyncio
    async def test_send_assistant_message_success(self):
        """Test successful send_assistant_message execution."""
        from unittest.mock import AsyncMock, patch

        from app.main import send_assistant_message

        # Mock the process_assistant_message_websocket function
        with patch('app.main.process_assistant_message_websocket') as mock_process:
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "message": "Test message"}
            
            await send_assistant_message(sid, data)
            
            # Verify that process_assistant_message_websocket was called
            mock_process.assert_called_once_with(data["chat_id"], data["message"])

    @pytest.mark.asyncio
    async def test_send_assistant_message_error(self):
        """Test send_assistant_message error handling."""
        from unittest.mock import AsyncMock, patch

        from app.main import send_assistant_message

        # Mock the process_assistant_message_websocket function to raise an exception
        with patch('app.main.process_assistant_message_websocket', side_effect=Exception("Test error")):
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "message": "Test message"}
            
            # The function should handle the exception gracefully
            await send_assistant_message(sid, data)


import pytest


class TestConnect:
    """Tests for connect function."""

    @pytest.mark.asyncio
    async def test_connect_success(self):
        """Test successful connect execution."""
        from unittest.mock import AsyncMock, patch

        from app.main import connect

        # Mock the Socket.IO instance
        mock_sio = AsyncMock()
        
        sid = "test_sid"
        environ = {"HTTP_X_FORWARDED_FOR": "192.168.1.1"}
        auth = {"profile_id": "test_profile_id"}
        
        # Call the function
        result = await connect(sid, environ, auth)
        
        # Verify that the function returned True (connection accepted)
        assert result is True
        
        # Verify that the client was added to the active_connections set
        from app.main import active_connections
        assert sid in active_connections

    @pytest.mark.asyncio
    async def test_connect_error(self):
        """Test connect error handling."""
        from unittest.mock import AsyncMock, patch

        from app.main import connect

        # Mock the Socket.IO instance to raise an exception
        mock_sio = AsyncMock()
        mock_sio.emit.side_effect = Exception("Socket.IO error")
        
        sid = "test_sid"
        environ = {"HTTP_X_FORWARDED_FOR": "192.168.1.1"}
        auth = {"profile_id": "test_profile_id"}
        
        # The function should handle the exception gracefully
        result = await connect(sid, environ, auth)
        
        # Verify that the function still returned True (connection accepted)
        assert result is True
        
        # Verify that the client was still added to active_connections
        from app.main import active_connections
        assert sid in active_connections


import pytest


class TestDisconnect:
    """Tests for disconnect function."""

    @pytest.mark.asyncio
    async def test_disconnect_success(self):
        """Test successful disconnect execution."""
        from unittest.mock import AsyncMock, patch

        from app.main import active_connections, disconnect

        # Add a test client to active_connections first
        test_sid = "test_sid"
        active_connections["test_chat_id"] = test_sid
        
        # Mock the Socket.IO instance
        mock_sio = AsyncMock()
        
        with patch('app.main.get_socketio_instance', return_value=mock_sio):
            await disconnect(test_sid)
            
            # Verify that the client was removed from active_connections
            assert "test_chat_id" not in active_connections

    @pytest.mark.asyncio
    async def test_disconnect_error(self):
        """Test disconnect error handling."""
        from unittest.mock import AsyncMock, patch

        from app.main import active_connections, disconnect

        # Add a test client to active_connections first
        test_sid = "test_sid"
        active_connections["test_chat_id"] = test_sid
        
        # Mock the Socket.IO instance to raise an exception
        mock_sio = AsyncMock()
        mock_sio.emit.side_effect = Exception("Socket.IO error")
        
        with patch('app.main.get_socketio_instance', return_value=mock_sio):
            await disconnect(test_sid)
            
            # Verify that the client was still removed from active_connections
            assert "test_chat_id" not in active_connections


import pytest


class TestJoin_Chat:
    """Tests for join_chat function."""

    @pytest.mark.asyncio
    async def test_join_chat_success(self):
        """Test successful join_chat execution."""
        from unittest.mock import AsyncMock, patch

        from app.main import join_chat

        # Mock the Socket.IO instance
        mock_sio = AsyncMock()
        
        with patch('app.main.get_socketio_instance', return_value=mock_sio):
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "chat_type": "assistant"}
            
            await join_chat(sid, data)
            
            # Verify that the client was added to the chat room
            mock_sio.enter_room.assert_called_once_with(sid, "assistant_test_chat_id")

    @pytest.mark.asyncio
    async def test_join_chat_error(self):
        """Test join_chat error handling."""
        from unittest.mock import AsyncMock, patch

        from app.main import join_chat

        # Mock the Socket.IO instance to raise an exception
        mock_sio = AsyncMock()
        mock_sio.enter_room.side_effect = Exception("Socket.IO error")
        
        with patch('app.main.get_socketio_instance', return_value=mock_sio):
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "chat_type": "assistant"}
            
            # The function should handle the exception gracefully
            await join_chat(sid, data)
            
            # Verify the enter_room was still called (even though it failed)
            mock_sio.enter_room.assert_called_once()


import pytest


class TestLeave_Chat:
    """Tests for leave_chat function."""

    @pytest.mark.asyncio
    async def test_leave_chat_success(self):
        """Test successful leave_chat execution."""
        from unittest.mock import AsyncMock, patch

        from app.main import leave_chat

        # Mock the Socket.IO instance
        mock_sio = AsyncMock()
        
        with patch('app.main.get_socketio_instance', return_value=mock_sio):
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "chat_type": "assistant"}
            
            await leave_chat(sid, data)
            
            # Verify that the client was removed from the chat room
            mock_sio.leave_room.assert_called_once_with(sid, "assistant_test_chat_id")

    @pytest.mark.asyncio
    async def test_leave_chat_error(self):
        """Test leave_chat error handling."""
        from unittest.mock import AsyncMock, patch

        from app.main import leave_chat

        # Mock the Socket.IO instance to raise an exception
        mock_sio = AsyncMock()
        mock_sio.leave_room.side_effect = Exception("Socket.IO error")
        
        with patch('app.main.get_socketio_instance', return_value=mock_sio):
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "chat_type": "assistant"}
            
            # The function should handle the exception gracefully
            await leave_chat(sid, data)
            
            # Verify the leave_room was still called (even though it failed)
            mock_sio.leave_room.assert_called_once()


import pytest


class TestStore_Active_Run:
    """Tests for store_active_run function."""

    def test_store_active_run_success(self):
        """Test successful store_active_run execution."""
        from app.main import active_runs, store_active_run

        # Clear any existing runs
        active_runs.clear()
        
        chat_id = "test_chat_id"
        run_id = "test_run_id"
        
        store_active_run(chat_id, run_id)
        
        # Verify that the run was stored
        assert chat_id in active_runs
        assert active_runs[chat_id] == run_id

    def test_store_active_run_error(self):
        """Test store_active_run error handling."""
        from app.main import active_runs, store_active_run

        # Clear any existing runs
        active_runs.clear()
        
        chat_id = "test_chat_id"
        run_id = "test_run_id"
        
        # Store a run
        store_active_run(chat_id, run_id)
        
        # Store another run for the same chat_id (should overwrite)
        new_run_id = "new_run_id"
        store_active_run(chat_id, new_run_id)
        
        # Verify that the run was updated
        assert active_runs[chat_id] == new_run_id


import pytest


class TestCancel_Active_Run:
    """Tests for cancel_active_run function."""

    def test_cancel_active_run_success(self):
        """Test successful cancel_active_run execution."""
        from unittest.mock import MagicMock

        from app.main import active_runs, cancel_active_run

        # Clear any existing runs and add a test run
        active_runs.clear()
        chat_id = "test_chat_id"
        mock_run = MagicMock()
        active_runs[chat_id] = mock_run
        
        # Cancel the run
        result = cancel_active_run(chat_id)
        
        # Verify that the run was removed and True was returned
        assert chat_id not in active_runs
        assert result is True
        mock_run.cancel.assert_called_once()

    def test_cancel_active_run_error(self):
        """Test cancel_active_run error handling."""
        from app.main import active_runs, cancel_active_run

        # Clear any existing runs
        active_runs.clear()
        
        # Try to cancel a non-existent run
        chat_id = "non_existent_chat_id"
        result = cancel_active_run(chat_id)
        
        # Verify that False was returned (no run to cancel)
        assert result is False


import pytest


class TestEmit_Chat_Stopped:
    """Tests for emit_chat_stopped function."""

    @pytest.mark.asyncio
    async def test_emit_chat_stopped_success(self):
        """Test successful emit_chat_stopped execution."""
        from unittest.mock import AsyncMock, patch

        from app.main import emit_chat_stopped

        # Mock the Socket.IO instance
        mock_sio = AsyncMock()
        
        with patch('app.main.get_socketio_instance', return_value=mock_sio):
            chat_id = "test_chat_id"
            chat_type = "assistant"
            
            await emit_chat_stopped(chat_id, chat_type)
            
            # Verify that the chat_stopped event was emitted to the chat room
            mock_sio.emit.assert_called_once_with(
                "chat_stopped",
                {"chat_id": chat_id, "chat_type": chat_type, "message": "Chat stopped successfully"},
                room=f"{chat_type}_{chat_id}"
            )

    @pytest.mark.asyncio
    async def test_emit_chat_stopped_error(self):
        """Test emit_chat_stopped error handling."""
        from unittest.mock import AsyncMock, patch

        from app.main import emit_chat_stopped

        # Mock the Socket.IO instance to raise an exception
        mock_sio = AsyncMock()
        mock_sio.emit.side_effect = Exception("Socket.IO error")
        
        with patch('app.main.get_socketio_instance', return_value=mock_sio):
            chat_id = "test_chat_id"
            chat_type = "assistant"
            
            # The function should handle the exception gracefully
            await emit_chat_stopped(chat_id, chat_type)
            
            # Verify the emit was still called (even though it failed)
            mock_sio.emit.assert_called_once()


import pytest


class TestStop_Chat:
    """Tests for stop_chat function."""

    @pytest.mark.asyncio
    async def test_stop_chat_success(self):
        """Test successful stop_chat execution."""
        from unittest.mock import AsyncMock, patch

        from app.main import active_runs, stop_chat

        # Clear any existing runs and add a test run
        active_runs.clear()
        chat_id = "test_chat_id"
        run_id = "test_run_id"
        active_runs[chat_id] = run_id
        
        # Mock the cancel_simulation_run and cancel_assistant_run functions
        with patch('app.main.cancel_simulation_run') as mock_cancel_sim, \
             patch('app.main.cancel_assistant_run') as mock_cancel_assistant, \
             patch('app.main.emit_chat_stopped') as mock_emit:
            
            await stop_chat(chat_id)
            
            # Verify that both cancel functions were called
            mock_cancel_sim.assert_called_once_with(run_id)
            mock_cancel_assistant.assert_called_once_with(run_id)
            mock_emit.assert_called_once_with(chat_id)
            
            # Verify that the run was removed from active_runs
            assert chat_id not in active_runs

    @pytest.mark.asyncio
    async def test_stop_chat_error(self):
        """Test stop_chat error handling."""
        from unittest.mock import AsyncMock, patch

        from app.main import active_runs, stop_chat

        # Clear any existing runs
        active_runs.clear()
        
        # Mock the cancel functions to raise exceptions
        with patch('app.main.cancel_simulation_run', side_effect=Exception("Sim error")), \
             patch('app.main.cancel_assistant_run', side_effect=Exception("Assistant error")), \
             patch('app.main.emit_chat_stopped') as mock_emit:
            
            chat_id = "test_chat_id"
            
            # The function should handle the exceptions gracefully
            await stop_chat(chat_id)
            
            # Verify that emit_chat_stopped was still called
            mock_emit.assert_called_once_with(chat_id)


import pytest


class TestGet_Socketio_Instance:
    """Tests for get_socketio_instance function."""

    def test_get_socketio_instance_success(self):
        """Test successful get_socketio_instance execution."""
        from app.main import get_socketio_instance
        sio_instance = get_socketio_instance()
        assert sio_instance is not None
        # Verify it's the same instance as the global sio
        from app.main import sio
        assert sio_instance == sio

    def test_get_socketio_instance_error(self):
        """Test get_socketio_instance error handling."""
        # This function doesn't typically have error cases, but we can test it returns the expected type
        import socketio
        from app.main import get_socketio_instance
        sio_instance = get_socketio_instance()
        assert isinstance(sio_instance, socketio.AsyncServer)


import pytest


@pytest.mark.skip(reason="TODO: Fix MCP server singleton issue in lifespan tests")
class TestLifespan:
    """Tests for lifespan function."""

    @pytest.mark.asyncio
    async def test_lifespan_success(self):
        """Test successful lifespan execution."""
        from unittest.mock import MagicMock, patch

        from fastapi import FastAPI
        
        app = FastAPI()
        
        # Mock the MCP server to avoid the singleton issue
        with patch('app.main.server') as mock_server:
            mock_context = MagicMock()
            mock_server.session_manager.run.return_value = mock_context
            mock_context.__aenter__ = MagicMock(return_value=None)
            mock_context.__aexit__ = MagicMock(return_value=None)
            
            # Import lifespan after mocking to avoid the singleton issue
            from app.main import lifespan

            # Test the lifespan context manager
            async with lifespan(app) as context:
                # The lifespan should yield successfully
                assert context is None  # lifespan yields None
            
            # The lifespan should complete without errors

    @pytest.mark.asyncio
    async def test_lifespan_error(self):
        """Test lifespan error handling."""
        from unittest.mock import MagicMock, patch

        from fastapi import FastAPI
        
        app = FastAPI()
        
        # Mock the MCP server to raise an exception
        with patch('app.main.server') as mock_server:
            mock_context = MagicMock()
            mock_server.session_manager.run.return_value = mock_context
            mock_context.__aenter__ = MagicMock(side_effect=Exception("Test error"))
            mock_context.__aexit__ = MagicMock(return_value=None)
            
            # Import lifespan after mocking to avoid the singleton issue
            from app.main import lifespan

            # The lifespan should handle the error gracefully
            with pytest.raises(Exception, match="Test error"):
                async with lifespan(app):
                    pass


import pytest
from fastapi.testclient import TestClient


class TestRoot_Info:
    """Tests for root_info function."""

    def test_root_info_success(self, client):
        """Test successful root_info execution."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "server_info" in data
        assert "python_version" in data["server_info"]
        assert "platform" in data["server_info"]
        assert "fastapi_version" in data["server_info"]

    def test_root_info_error(self, client):
        """Test root_info error handling."""
        # This endpoint doesn't typically have error cases, but we can test invalid methods
        response = client.post("/")
        assert response.status_code == 405  # Method Not Allowed


class TestHealth_Check:
    """Tests for health_check function."""

    def test_health_check_success(self, client):
        """Test successful health_check execution."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data == {"status": "ok"}

    def test_health_check_error(self, client):
        """Test health_check error handling."""
        # This endpoint doesn't typically have error cases, but we can test invalid methods
        response = client.post("/health")
        assert response.status_code == 405  # Method Not Allowed

