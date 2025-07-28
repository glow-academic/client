"""
Tests for app.web.simulations
"""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from app.web.simulations import *
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
        from app.web.simulations import get_sio_instance

        # Test that get_sio_instance returns the same instance as get_socketio_instance
        sio_instance = get_sio_instance()
        expected_instance = get_socketio_instance()
        
        assert sio_instance is expected_instance
        assert sio_instance is not None

    def test_get_sio_instance_error(self):
        """Test get_sio_instance error handling."""
        from unittest.mock import patch

        from app.web.simulations import get_sio_instance

        # Mock the import to raise an exception
        with patch('app.main.get_socketio_instance', side_effect=ImportError("Module not found")):
            with pytest.raises(ImportError, match="Module not found"):
                get_sio_instance()


import pytest


class TestHandle_Start_Simulation:
    """Tests for handle_start_simulation function."""

    @pytest.mark.asyncio
    async def test_handle_start_simulation_success(self):
        """Test successful handle_start_simulation execution."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.models import Scenarios, SimulationAttempts, Simulations
        from app.web.simulations import handle_start_simulation

        # Mock all dependencies
        with patch('app.web.simulations.get_sio_instance') as mock_get_sio, \
             patch('app.web.simulations.get_session') as mock_get_session, \
             patch('app.web.simulations.gen_trace_id') as mock_gen_trace, \
             patch('app.web.simulations.randomly_fill_scenario_attributes') as mock_fill_attrs, \
             patch('app.web.simulations.run_scenario_agent') as mock_run_scenario:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the simulation
            mock_simulation = MagicMock()
            mock_simulation.id = str(uuid.uuid4())
            mock_simulation.scenario_ids = [str(uuid.uuid4())]
            mock_session.exec.return_value.one_or_none.return_value = mock_simulation
            
            # Mock the scenario
            mock_scenario = MagicMock()
            mock_scenario.id = str(uuid.uuid4())
            mock_scenario.name = "Test Scenario"
            mock_scenario.description = "Test Description"
            mock_scenario.persona_id = str(uuid.uuid4())
            mock_scenario.document_ids = []
            mock_scenario.parameter_item_ids = []
            mock_fill_attrs.return_value = mock_scenario
            
            # Mock the attempt
            mock_attempt = MagicMock()
            mock_attempt.id = str(uuid.uuid4())
            
            # Mock the chat
            mock_chat = MagicMock()
            mock_chat.id = str(uuid.uuid4())
            
            mock_session.add.return_value = None
            mock_session.commit.return_value = None
            mock_session.refresh.return_value = None
            
            # Test data
            sid = "test_sid"
            data = {
                "simulation_id": str(uuid.uuid4()),
                "profile_id": str(uuid.uuid4())
            }
            
            # Execute the function
            await handle_start_simulation(sid, data)
            
            # Verify the function executed successfully
            mock_get_sio.assert_called_once()
            mock_get_session.assert_called_once()
            mock_fill_attrs.assert_called_once()
            
            # Verify the attempt was created
            mock_session.add.assert_called()
            mock_session.commit.assert_called()
            mock_session.refresh.assert_called()
            
            # Verify Socket.IO operations - use the chat.id for room name
            mock_sio.enter_room.assert_called_once_with(sid, f"simulation_{mock_chat.id}")
            assert mock_sio.emit.call_count >= 1  # At least one emit call

    @pytest.mark.asyncio
    async def test_handle_start_simulation_error(self):
        """Test handle_start_simulation error handling."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.web.simulations import handle_start_simulation

        # Mock all dependencies
        with patch('app.web.simulations.get_sio_instance') as mock_get_sio, \
             patch('app.web.simulations.get_session') as mock_get_session, \
             patch('app.web.simulations.emit_error') as mock_emit_error:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the simulation to be None (simulation not found)
            mock_session.exec.return_value.one_or_none.return_value = None
            
            # Test data
            sid = "test_sid"
            data = {
                "simulation_id": str(uuid.uuid4()),
                "profile_id": str(uuid.uuid4())
            }
            
            # Execute the function
            await handle_start_simulation(sid, data)
            
            # Verify error was emitted
            mock_emit_error.assert_called_once_with(sid, "Simulation not found")


import pytest


class TestHandle_Stop_Simulation:
    """Tests for handle_stop_simulation function."""

    @pytest.mark.asyncio
    async def test_handle_stop_simulation_success(self):
        """Test successful handle_stop_simulation execution."""
        import uuid
        from datetime import datetime
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.models import SimulationChats, SimulationMessages
        from app.web.simulations import handle_stop_simulation

        # Mock all dependencies
        with patch('app.web.simulations.get_sio_instance') as mock_get_sio, \
             patch('app.web.simulations.get_session') as mock_get_session, \
             patch('app.web.simulations.cancel_simulation_run') as mock_cancel:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the chat
            mock_chat = MagicMock()
            mock_chat.id = str(uuid.uuid4())
            mock_session.exec.return_value.one_or_none.return_value = mock_chat
            
            # Mock successful cancellation
            mock_cancel.return_value = True
            
            # Mock assistant messages
            mock_message = MagicMock()
            mock_message.id = uuid.uuid4()
            mock_message.created_at = datetime.now()
            mock_message.completed = False
            mock_message.content = "Test content"
            mock_session.exec.return_value.all.return_value = [mock_message]
            
            # Test data
            sid = "test_sid"
            data = {"chat_id": str(uuid.uuid4())}
            
            # Execute the function
            await handle_stop_simulation(sid, data)
            
            # Verify the function executed successfully
            mock_get_sio.assert_called_once()
            mock_get_session.assert_called_once()
            mock_cancel.assert_called_once_with(data['chat_id'])
            
            # Verify Socket.IO emits
            assert mock_sio.emit.call_count >= 1  # At least one emit call

    @pytest.mark.asyncio
    async def test_handle_stop_simulation_error(self):
        """Test handle_stop_simulation error handling."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.web.simulations import handle_stop_simulation

        # Mock all dependencies
        with patch('app.web.simulations.get_sio_instance') as mock_get_sio, \
             patch('app.web.simulations.get_session') as mock_get_session, \
             patch('app.web.simulations.emit_error') as mock_emit_error:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the chat to be None (chat not found)
            mock_session.exec.return_value.one_or_none.return_value = None
            
            # Test data
            sid = "test_sid"
            data = {"chat_id": str(uuid.uuid4())}
            
            # Execute the function
            await handle_stop_simulation(sid, data)
            
            # Verify error was emitted
            mock_emit_error.assert_called_once_with(sid, "Chat not found")


import pytest


class TestHandle_Continue_Simulation:
    """Tests for handle_continue_simulation function."""

    @pytest.mark.asyncio
    async def test_handle_continue_simulation_success(self):
        """Test successful handle_continue_simulation execution."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.models import (Scenarios, SimulationAttempts, SimulationChats,
                                Simulations)
        from app.web.simulations import handle_continue_simulation

        # Mock all dependencies
        with patch('app.web.simulations.get_sio_instance') as mock_get_sio, \
             patch('app.web.simulations.get_session') as mock_get_session, \
             patch('app.web.simulations.gen_trace_id') as mock_gen_trace, \
             patch('app.web.simulations.randomly_fill_scenario_attributes') as mock_fill_attrs, \
             patch('app.web.simulations.run_scenario_agent') as mock_run_scenario:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the chat
            mock_chat = MagicMock()
            mock_chat.id = str(uuid.uuid4())
            
            # Mock the simulation
            mock_simulation = MagicMock()
            mock_simulation.scenario_ids = [str(uuid.uuid4()), str(uuid.uuid4())]  # Multiple scenarios
            
            # Mock existing chats
            mock_session.exec.return_value.all.return_value = [mock_chat]  # One existing chat
            
            # Mock the scenario
            mock_scenario = MagicMock()
            mock_scenario.id = str(uuid.uuid4())
            mock_scenario.name = "Test Scenario"
            mock_scenario.description = "Test Description"
            mock_fill_attrs.return_value = mock_scenario
            
            # Set up the side effect for one_or_none to return different objects
            mock_session.exec.return_value.one_or_none.side_effect = [
                mock_chat,  # chat
                MagicMock(),  # attempt
                mock_simulation,  # simulation
                mock_scenario  # scenario
            ]
            
            # Test data
            sid = "test_sid"
            data = {
                "chat_id": str(uuid.uuid4()),
                "attempt_id": str(uuid.uuid4())
            }
            
            # Execute the function
            await handle_continue_simulation(sid, data)
            
            # Verify the function executed successfully
            mock_get_sio.assert_called_once()
            mock_get_session.assert_called_once()
            mock_fill_attrs.assert_called_once()
            
            # Verify Socket.IO operations
            mock_sio.enter_room.assert_called_once()
            assert mock_sio.emit.call_count >= 1  # At least one emit call

    @pytest.mark.asyncio
    async def test_handle_continue_simulation_error(self):
        """Test handle_continue_simulation error handling."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.web.simulations import handle_continue_simulation

        # Mock all dependencies
        with patch('app.web.simulations.get_sio_instance') as mock_get_sio, \
             patch('app.web.simulations.get_session') as mock_get_session, \
             patch('app.web.simulations.emit_error') as mock_emit_error:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the chat to be None (chat not found)
            mock_session.exec.return_value.one_or_none.return_value = None
            
            # Test data
            sid = "test_sid"
            data = {
                "chat_id": str(uuid.uuid4()),
                "attempt_id": str(uuid.uuid4())
            }
            
            # Execute the function
            await handle_continue_simulation(sid, data)
            
            # Verify error was emitted
            mock_emit_error.assert_called_once_with(sid, "Chat not found")


import pytest


class TestProcess_Simulation_Message_Websocket:
    """Tests for process_simulation_message_websocket function."""

    @pytest.mark.asyncio
    async def test_process_simulation_message_websocket_success(self):
        """Test successful process_simulation_message_websocket execution."""
        import uuid
        from datetime import datetime
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.models import SimulationChats, SimulationMessages
        from app.web.simulations import process_simulation_message_websocket

        # Mock all dependencies
        with patch('app.web.simulations.get_sio_instance') as mock_get_sio, \
             patch('app.web.simulations.get_session') as mock_get_session, \
             patch('app.web.simulations.run_simulation_agent') as mock_run_agent:

            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio

            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])

            # Mock the chat
            mock_chat = MagicMock()
            mock_chat.id = str(uuid.uuid4())
            mock_session.exec.return_value.one_or_none.return_value = mock_chat

            # Mock the user message
            mock_user_message = MagicMock()
            mock_user_message.id = uuid.uuid4()
            mock_user_message.created_at = datetime.now()
            
            # Mock the assistant message
            mock_assistant_message = MagicMock()
            mock_assistant_message.id = uuid.uuid4()
            mock_assistant_message.created_at = datetime.now()
            
            # Mock the SimulationMessages constructor
            with patch('app.web.simulations.SimulationMessages') as mock_sim_messages:
                mock_sim_messages.side_effect = [mock_user_message, mock_assistant_message]
                
                mock_session.add.return_value = None
                mock_session.commit.return_value = None
                mock_session.refresh.return_value = None

                # Mock the assistant agent to return a simple token
                async def mock_agent_generator():
                    yield "Hello, I'm the simulation assistant!"

                mock_run_agent.return_value = mock_agent_generator()

                # Test data
                chat_id = str(uuid.uuid4())
                message = "Hello, simulation assistant!"

                # Execute the function
                await process_simulation_message_websocket(chat_id, message)

                # Verify the function executed successfully
                mock_get_sio.assert_called_once()
                mock_get_session.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_simulation_message_websocket_error(self):
        """Test process_simulation_message_websocket error handling."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock, patch

        from app.web.simulations import process_simulation_message_websocket

        # Mock all dependencies
        with patch('app.web.simulations.get_sio_instance') as mock_get_sio, \
             patch('app.web.simulations.get_session') as mock_get_session, \
             patch('app.web.simulations.run_simulation_agent') as mock_run_agent:
            
            # Setup mocks
            mock_sio = AsyncMock()
            mock_get_sio.return_value = mock_sio
            
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])
            
            # Mock the chat to be None (chat not found)
            mock_session.exec.return_value.one_or_none.return_value = None
            
            # Test data
            chat_id = str(uuid.uuid4())
            message = "Hello, simulation assistant!"
            
            # Execute the function - it should raise a ValueError
            with pytest.raises(ValueError, match=f"Chat {chat_id} not found"):
                await process_simulation_message_websocket(chat_id, message)


import pytest


class TestEmit_Error:
    """Tests for emit_error function."""

    @pytest.mark.asyncio
    async def test_emit_error_success(self):
        """Test successful emit_error execution."""
        from unittest.mock import AsyncMock, patch

        from app.web.simulations import emit_error

        # Mock the Socket.IO instance
        mock_sio = AsyncMock()
        
        with patch('app.web.simulations.get_sio_instance', return_value=mock_sio):
            sid = "test_sid"
            error_message = "Test error message"
            
            await emit_error(sid, error_message)
            
            # Verify the emit was called with correct parameters
            mock_sio.emit.assert_called_once_with(
                "simulation_error",
                {"success": False, "message": error_message},
                room=sid
            )

    @pytest.mark.asyncio
    async def test_emit_error_error(self):
        """Test emit_error error handling."""
        from unittest.mock import AsyncMock, patch

        from app.web.simulations import emit_error

        # Mock the Socket.IO instance to raise an exception
        mock_sio = AsyncMock()
        mock_sio.emit.side_effect = Exception("Socket.IO error")
        
        with patch('app.web.simulations.get_sio_instance', return_value=mock_sio):
            sid = "test_sid"
            error_message = "Test error message"
            
            # The function should raise the exception since it doesn't have error handling
            with pytest.raises(Exception, match="Socket.IO error"):
                await emit_error(sid, error_message)


import pytest


class TestRegister_Simulation_Events:
    """Tests for register_simulation_events function."""

    def test_register_simulation_events_success(self):
        """Test successful register_simulation_events execution."""
        from unittest.mock import MagicMock, patch

        from app.web.simulations import register_simulation_events

        # Mock the Socket.IO server
        mock_sio = MagicMock()
        
        # Call the function - it should register event handlers
        register_simulation_events(mock_sio)
        
        # Verify that the event method was called three times (for start, stop, continue)
        assert mock_sio.event.call_count == 3

    def test_register_simulation_events_error(self):
        """Test register_simulation_events error handling."""
        from unittest.mock import MagicMock, patch

        from app.web.simulations import register_simulation_events

        # Mock the Socket.IO server to raise an exception
        mock_sio = MagicMock()
        mock_sio.event.side_effect = Exception("Registration error")
        
        # Mock the event method to raise an exception
        mock_sio.event.side_effect = Exception("Registration error")
        
        # The function should handle the exception gracefully
        with pytest.raises(Exception, match="Registration error"):
            register_simulation_events(mock_sio)

