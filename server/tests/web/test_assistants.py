"""
Tests for app.web.assistants
"""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from app.web.assistants import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest


class TestGet_Sio_Instance:
    """Tests for get_sio_instance function."""

    def test_get_sio_instance_success(self):
        """Test successful get_sio_instance execution."""
        from app.main import get_socketio_instance
        from app.web.assistants import get_sio_instance

        # Test that get_sio_instance returns the same instance as get_socketio_instance
        sio_instance = get_sio_instance()
        expected_instance = get_socketio_instance()
        
        assert sio_instance is expected_instance
        assert sio_instance is not None

    def test_get_sio_instance_error(self):
        """Test get_sio_instance error handling."""
        from unittest.mock import patch

        from app.web.assistants import get_sio_instance

        # Mock the import to raise an exception
        with patch('app.main.get_socketio_instance', side_effect=ImportError("Module not found")):
            with pytest.raises(ImportError, match="Module not found"):
                get_sio_instance()


import pytest


class TestHandle_Start_Assistant:
    """Tests for handle_start_assistant function."""

    @pytest.mark.asyncio
    async def test_handle_start_assistant_success(self):
        """Test successful handle_start_assistant execution."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.models import AssistantChats
        from app.web.assistants import handle_start_assistant

        # Mock all dependencies
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session, \
             patch('agents.gen_trace_id') as mock_gen_trace, \
             patch('app.web.assistants.run_title_agent') as mock_run_title:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Add debug output to see if get_session is called
            def mock_get_session_side_effect():
                print("DEBUG: get_session called")
                return iter([mock_session])
            
            mock_get_session.side_effect = mock_get_session_side_effect
            
            mock_gen_trace.return_value = "test-trace-id"
            
            # Add debug output to see if gen_trace_id is called
            def mock_gen_trace_side_effect():
                print("DEBUG: gen_trace_id called")
                return "test-trace-id"
            
            mock_gen_trace.side_effect = mock_gen_trace_side_effect
            
            mock_run_title.return_value = "Test Chat Title"
            
            # Test data
            sid = "test_sid"
            chat_id = str(uuid.uuid4())
            data = {
                "chat_id": chat_id,
                "initial_message": "Hello, assistant!"
            }
            
            # Mock the chat object
            mock_chat = MagicMock()
            mock_chat.id = uuid.UUID(chat_id)
            
            # Set up the mock to return the chat for any call to get
            mock_session.get.return_value = mock_chat
            
            # Execute the function
            print("DEBUG: About to call handle_start_assistant")
            await handle_start_assistant(sid, data)
            print("DEBUG: handle_start_assistant called")
            
            # Verify the function executed successfully
            mock_get_sio.assert_called_once()
            mock_get_session.assert_called_once()
            mock_gen_trace.assert_called_once()
            mock_run_title.assert_called_once()
            
            # Verify the chat was updated
            mock_session.add.assert_called_once_with(mock_chat)
            mock_session.commit.assert_called_once()
            mock_session.refresh.assert_called_once_with(mock_chat)
            
            # Verify Socket.IO operations
            mock_sio.enter_room.assert_called_once_with(sid, f"assistant_{data['chat_id']}")
            assert mock_sio.emit.call_count == 2  # title_updated and assistant_started

    @pytest.mark.asyncio
    async def test_handle_start_assistant_error(self):
        """Test handle_start_assistant error handling."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.web.assistants import handle_start_assistant

        # Mock all dependencies
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session, \
             patch('app.web.assistants.emit_assistant_error') as mock_emit_error:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the chat object to be None (chat not found)
            mock_session.get.return_value = None
            
            # Test data
            sid = "test_sid"
            data = {
                "chat_id": str(uuid.uuid4()),
                "initial_message": "Hello, assistant!"
            }
            
            # Execute the function
            await handle_start_assistant(sid, data)
            
            # Verify error was emitted
            mock_emit_error.assert_called_once_with(sid, "Chat not found")


import pytest


class TestHandle_Stop_Assistant:
    """Tests for handle_stop_assistant function."""

    @pytest.mark.asyncio
    async def test_handle_stop_assistant_success(self):
        """Test successful handle_stop_assistant execution."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.models import AssistantChats
        from app.web.assistants import handle_stop_assistant

        # Mock all dependencies
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session, \
             patch('app.web.assistants.cancel_assistant_run') as mock_cancel:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Test data
            sid = "test_sid"
            chat_id = str(uuid.uuid4())
            data = {"chat_id": chat_id}
            
            # Mock the chat object
            mock_chat = MagicMock()
            mock_chat.id = uuid.UUID(chat_id)
            
            # Set up the mock to return the chat for any call to get
            mock_session.get.return_value = mock_chat
            
            # Mock successful cancellation
            mock_cancel.return_value = True
            
            # Execute the function
            await handle_stop_assistant(sid, data)
            
            # Verify the function executed successfully
            mock_get_sio.assert_called_once()
            mock_get_session.assert_called_once()
            mock_cancel.assert_called_once_with(uuid.UUID(data['chat_id']))
            
            # Verify Socket.IO emit was called with success
            mock_sio.emit.assert_called_once_with(
                "assistant_stopped",
                {
                    "chat_id": data['chat_id'],
                    "success": True,
                    "message": "Assistant stopped successfully",
                },
                room=f"assistant_{data['chat_id']}",
            )

    @pytest.mark.asyncio
    async def test_handle_stop_assistant_error(self):
        """Test handle_stop_assistant error handling."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.web.assistants import handle_stop_assistant

        # Mock all dependencies
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session, \
             patch('app.web.assistants.emit_assistant_error') as mock_emit_error:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the chat object to be None (chat not found)
            mock_session.get.return_value = None
            
            # Test data
            sid = "test_sid"
            data = {"chat_id": str(uuid.uuid4())}
            
            # Execute the function
            await handle_stop_assistant(sid, data)
            
            # Verify error was emitted
            mock_emit_error.assert_called_once_with(sid, "Chat not found")


import pytest


class TestProcess_Assistant_Message_Websocket:
    """Tests for process_assistant_message_websocket function."""

    @pytest.mark.asyncio
    async def test_process_assistant_message_websocket_success(self):
        """Test successful process_assistant_message_websocket execution."""
        import uuid
        from datetime import datetime
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.models import AssistantMessages
        from app.web.assistants import process_assistant_message_websocket

        # Mock all dependencies
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session, \
             patch('app.web.assistants.run_assistant_agent') as mock_run_agent:

            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio

            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])

            # Mock the user message creation
            mock_user_message = MagicMock()
            mock_user_message.id = uuid.uuid4()
            mock_user_message.created_at = datetime.now()
            
            # Mock the AssistantMessages constructor
            with patch('app.web.assistants.AssistantMessages', return_value=mock_user_message):
                mock_session.add.return_value = None
                mock_session.commit.return_value = None
                mock_session.refresh.return_value = None

                # Mock the assistant agent to return a simple token
                async def mock_agent_generator():
                    yield "Hello, I'm the assistant!"

                mock_run_agent.return_value = mock_agent_generator()

                # Test data
                chat_id = uuid.uuid4()
                message = "Hello, assistant!"

                # Execute the function
                await process_assistant_message_websocket(chat_id, message)

                # Verify the function executed successfully
                mock_get_sio.assert_called_once()
                mock_get_session.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_assistant_message_websocket_error(self):
        """Test process_assistant_message_websocket error handling."""
        import uuid
        from datetime import datetime
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.web.assistants import process_assistant_message_websocket

        # Mock all dependencies
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session, \
             patch('app.web.assistants.run_assistant_agent') as mock_run_agent:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the user message creation
            mock_user_message = MagicMock()
            mock_user_message.id = uuid.uuid4()
            mock_user_message.created_at = datetime.now()
            
            # Mock the AssistantMessages constructor
            with patch('app.web.assistants.AssistantMessages', return_value=mock_user_message):
                mock_session.add.return_value = None
                mock_session.commit.return_value = None
                mock_session.refresh.return_value = None
                
                # Mock the assistant agent to raise an exception
                mock_run_agent.side_effect = Exception("Agent error")
                
                # Test data
                chat_id = uuid.uuid4()
                message = "Hello, assistant!"
                
                # Execute the function - it should handle the exception gracefully
                await process_assistant_message_websocket(chat_id, message)
                
                # Verify that error handling occurred
                assert mock_get_sio.call_count == 2  # Called for user message and error
                mock_get_session.assert_called_once()


import pytest


class TestEmit_Assistant_Error:
    """Tests for emit_assistant_error function."""

    @pytest.mark.asyncio
    async def test_emit_assistant_error_success(self):
        """Test successful emit_assistant_error execution."""
        from unittest.mock import AsyncMock, patch

        from app.web.assistants import emit_assistant_error

        # Mock the Socket.IO instance
        mock_sio = AsyncMock()
        
        with patch('app.web.assistants.get_sio_instance', return_value=mock_sio):
            sid = "test_sid"
            error_message = "Test error message"
            
            await emit_assistant_error(sid, error_message)
            
            # Verify the emit was called with correct parameters
            mock_sio.emit.assert_called_once_with(
                "assistant_error",
                {"success": False, "message": error_message},
                room=sid
            )

    @pytest.mark.asyncio
    async def test_emit_assistant_error_error(self):
        """Test emit_assistant_error error handling."""
        from unittest.mock import AsyncMock, patch

        from app.web.assistants import emit_assistant_error

        # Mock the Socket.IO instance to raise an exception
        mock_sio = AsyncMock()
        mock_sio.emit.side_effect = Exception("Socket.IO error")

        with patch('app.web.assistants.get_sio_instance', return_value=mock_sio):
            sid = "test_sid"
            error_message = "Test error message"

            # The function should raise the exception since it doesn't have error handling
            with pytest.raises(Exception, match="Socket.IO error"):
                await emit_assistant_error(sid, error_message)


import pytest


class TestRegister_Assistant_Events:
    """Tests for register_assistant_events function."""

    def test_register_assistant_events_success(self):
        """Test successful register_assistant_events execution."""
        from unittest.mock import MagicMock, patch

        from app.web.assistants import register_assistant_events

        # Mock the Socket.IO server
        mock_sio = MagicMock()
        
        # Call the function - it should register event handlers
        register_assistant_events(mock_sio)
        
        # Verify that the event method was called twice (for start_assistant and stop_assistant)
        assert mock_sio.event.call_count == 2

    def test_register_assistant_events_error(self):
        """Test register_assistant_events error handling."""
        from unittest.mock import MagicMock, patch

        from app.web.assistants import register_assistant_events

        # Mock the Socket.IO server to raise an exception
        mock_sio = MagicMock()
        mock_sio.event.side_effect = Exception("Registration error")
        
        # Mock the event method to raise an exception
        mock_sio.event.side_effect = Exception("Registration error")
        
        # The function should handle the exception gracefully
        with pytest.raises(Exception, match="Registration error"):
            register_assistant_events(mock_sio)


import pytest


class TestStart_Assistant:
    """Tests for start_assistant function."""

    @pytest.mark.asyncio
    async def test_start_assistant_success(self):
        """Test successful start_assistant execution."""
        from unittest.mock import AsyncMock, patch

        from app.web.assistants import handle_start_assistant

        # Mock the Socket.IO instance and database session
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session:
            
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "initial_message": "Hello"}
            
            # Test the function
            await handle_start_assistant(sid, data)
            
            # Verify that the Socket.IO instance was used
            mock_get_sio.assert_called_once()

    @pytest.mark.asyncio
    async def test_start_assistant_error(self):
        """Test start_assistant error handling."""
        from unittest.mock import AsyncMock, patch

        from app.web.assistants import handle_start_assistant

        # Mock the Socket.IO instance and database session
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session:
            
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            sid = "test_sid"
            data = {"chat_id": "test_chat_id", "initial_message": "Hello"}
            
            # Test with missing required fields
            data_missing = {"chat_id": "test_chat_id"}  # Missing initial_message
            
            # The function should handle missing fields gracefully
            await handle_start_assistant(sid, data_missing)
            
            # Verify that error was emitted
            mock_sio.emit.assert_called_once()


import pytest


class TestStop_Assistant:
    """Tests for stop_assistant function."""

    @pytest.mark.asyncio
    async def test_stop_assistant_success(self):
        """Test successful stop_assistant execution."""
        from unittest.mock import AsyncMock, patch

        from app.web.assistants import handle_stop_assistant

        # Mock the Socket.IO instance and database session
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session:
            
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            sid = "test_sid"
            data = {"chat_id": "test_chat_id"}
            
            # Test the function
            await handle_stop_assistant(sid, data)
            
            # Verify that the Socket.IO instance was used
            mock_get_sio.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_assistant_error(self):
        """Test stop_assistant error handling."""
        from unittest.mock import AsyncMock, patch

        from app.web.assistants import handle_stop_assistant

        # Mock the Socket.IO instance and database session
        with patch('app.web.assistants.get_sio_instance') as mock_get_sio, \
             patch('app.db.get_session') as mock_get_session:
            
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            sid = "test_sid"
            data = {"chat_id": "test_chat_id"}
            
            # Test with missing required fields
            data_missing = {}  # Missing chat_id
            
            # The function should handle missing fields gracefully
            await handle_stop_assistant(sid, data_missing)
            
            # Verify that error was emitted
            mock_sio.emit.assert_called_once()

