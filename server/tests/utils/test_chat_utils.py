"""
Tests for app.utils.chat
"""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from app.utils.chat import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest


class TestGet_Simulation_Conversation_History:
    """Tests for get_simulation_conversation_history function."""

    def test_get_simulation_conversation_history_success(self):
        """Test successful get_simulation_conversation_history execution."""
        from datetime import datetime

        from app.models import SimulationMessages
        from app.utils.chat import get_simulation_conversation_history

        # Create mock messages
        message1 = SimulationMessages(
            id=1,
            type="query",
            content="Hello, how are you?",
            created_at=datetime(2023, 1, 1, 10, 0, 0)
        )
        message2 = SimulationMessages(
            id=2,
            type="response",
            content="I'm doing well, thank you!",
            created_at=datetime(2023, 1, 1, 10, 1, 0)
        )
        
        result = get_simulation_conversation_history([message1, message2])
        
        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello, how are you?"
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == "I'm doing well, thank you!"

    def test_get_simulation_conversation_history_error(self):
        """Test get_simulation_conversation_history error handling."""
        from datetime import datetime

        from app.models import SimulationMessages
        from app.utils.chat import get_simulation_conversation_history

        # Test with empty messages list
        result = get_simulation_conversation_history([])
        
        assert len(result) == 0
        assert result == []


import pytest


class TestGet_Assistant_Conversation_History:
    """Tests for get_assistant_conversation_history function."""

    def test_get_assistant_conversation_history_success(self):
        """Test successful get_assistant_conversation_history execution."""
        from datetime import datetime

        from app.models import AssistantMessages, AssistantToolCalls
        from app.utils.chat import get_assistant_conversation_history

        # Create mock messages
        message1 = AssistantMessages(
            id=1,
            role="user",
            content="Hello, how are you?",
            created_at=datetime(2023, 1, 1, 10, 0, 0)
        )
        message2 = AssistantMessages(
            id=2,
            role="assistant",
            content="I'm doing well, thank you!",
            created_at=datetime(2023, 1, 1, 10, 1, 0)
        )
        
        # Create mock tool call
        tool_call = AssistantToolCalls(
            id=1,
            tool_name="test_tool",
            tool_arguments='{"param": "value"}',
            tool_result='{"result": "success"}',
            created_at=datetime(2023, 1, 1, 10, 2, 0)
        )
        
        result = get_assistant_conversation_history([message1, message2], [tool_call])
        
        assert len(result) == 4  # 2 messages + 1 tool call + 1 tool output
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello, how are you?"
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == "I'm doing well, thank you!"

    def test_get_assistant_conversation_history_error(self):
        """Test get_assistant_conversation_history error handling."""
        from app.utils.chat import get_assistant_conversation_history

        # Test with empty messages and tool calls
        result = get_assistant_conversation_history([], [])
        
        assert len(result) == 0
        assert result == []


import pytest


class TestGet_Chat_Scenario:
    """Tests for get_chat_scenario function."""

    def test_get_chat_scenario_success(self, mock_session):
        """Test successful get_chat_scenario execution."""
        from uuid import uuid4

        from app.models import Scenarios, SimulationChats
        from app.utils.chat import get_chat_scenario

        # Create mock chat and scenario
        chat_id = uuid4()
        scenario_id = uuid4()
        chat = SimulationChats(
            id=chat_id,
            scenario_id=scenario_id,
            name="Test Chat"
        )
        
        mock_scenario = Scenarios(
            id=scenario_id,
            name="Test Scenario",
            description="A test scenario description"
        )
        
        # Mock the database query
        mock_session.exec.return_value.one_or_none.return_value = mock_scenario
        
        result = get_chat_scenario(chat, mock_session)
        
        assert result["role"] == "user"
        assert "The following is the scenario for the chat:" in result["content"]
        assert "A test scenario description" in result["content"]

    def test_get_chat_scenario_error(self, mock_session):
        """Test get_chat_scenario error handling."""
        from uuid import uuid4

        from app.models import SimulationChats
        from app.utils.chat import get_chat_scenario

        # Create mock chat
        chat_id = uuid4()
        scenario_id = uuid4()
        chat = SimulationChats(
            id=chat_id,
            scenario_id=scenario_id,
            name="Test Chat"
        )
        
        # Mock the database query to return no scenario
        mock_session.exec.return_value.one_or_none.return_value = None
        
        with pytest.raises(ValueError, match=f"Scenario not found for chat {chat_id}"):
            get_chat_scenario(chat, mock_session)

