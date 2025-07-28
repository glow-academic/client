"""
Tests for app.utils.chat
"""

import json
import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from app.models import (AssistantMessages, AssistantToolCalls, Scenarios,
                        SimulationChats, SimulationMessages)
from app.utils.chat import (get_assistant_conversation_history,
                            get_chat_scenario,
                            get_simulation_conversation_history)
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestGet_Simulation_Conversation_History:
    """Tests for get_simulation_conversation_history function."""

    def test_get_simulation_conversation_history_success(self):
        """Test successful get_simulation_conversation_history execution."""
        # Create test messages
        chat_id = uuid.uuid4()
        messages = [
            SimulationMessages(
                id=uuid.uuid4(),
                chat_id=chat_id,
                type="query",
                content="Hello, how are you?",
                completed=True,
                audio=False,
                created_at=datetime(2024, 1, 1, 10, 0, 0),
            ),
            SimulationMessages(
                id=uuid.uuid4(),
                chat_id=chat_id,
                type="response",
                content="I'm doing well, thank you!",
                completed=True,
                audio=False,
                created_at=datetime(2024, 1, 1, 10, 1, 0),
            ),
            SimulationMessages(
                id=uuid.uuid4(),
                chat_id=chat_id,
                type="query",
                content="What's the weather like?",
                completed=True,
                audio=False,
                created_at=datetime(2024, 1, 1, 10, 2, 0),
            ),
        ]

        # Execute the function
        result = get_simulation_conversation_history(messages)

        # Verify the result
        assert len(result) == 3
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello, how are you?"
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == "I'm doing well, thank you!"
        assert result[2]["role"] == "user"
        assert result[2]["content"] == "What's the weather like?"

    def test_get_simulation_conversation_history_error(self):
        """Test get_simulation_conversation_history error handling."""
        # Test with empty messages list
        result = get_simulation_conversation_history([])
        assert result == []

        # Test with messages that have invalid types
        chat_id = uuid.uuid4()
        messages = [
            SimulationMessages(
                id=uuid.uuid4(),
                chat_id=chat_id,
                type="invalid_type",  # Invalid type
                content="This should be ignored",
                completed=True,
                audio=False,
                created_at=datetime(2024, 1, 1, 10, 0, 0),
            ),
        ]

        result = get_simulation_conversation_history(messages)
        assert result == []


class TestGet_Assistant_Conversation_History:
    """Tests for get_assistant_conversation_history function."""

    def test_get_assistant_conversation_history_success(self):
        """Test successful get_assistant_conversation_history execution."""
        # Create test data
        chat_id = uuid.uuid4()
        messages = [
            AssistantMessages(
                id=uuid.uuid4(),
                chat_id=chat_id,
                role="user",
                content="Hello, assistant!",
                completed=True,
                created_at=datetime(2024, 1, 1, 10, 0, 0),
            ),
            AssistantMessages(
                id=uuid.uuid4(),
                chat_id=chat_id,
                role="assistant",
                content="Hello! How can I help you?",
                completed=True,
                created_at=datetime(2024, 1, 1, 10, 1, 0),
            ),
        ]

        tool_calls = [
            AssistantToolCalls(
                id=uuid.uuid4(),
                chat_id=chat_id,
                tool_name="test_tool",
                tool_arguments=json.dumps({"param": "value"}),
                tool_result=json.dumps({"result": "success"}),
                created_at=datetime(2024, 1, 1, 10, 2, 0),
            ),
        ]

        # Execute the function
        result = get_assistant_conversation_history(messages, tool_calls)

        # Verify the result
        assert len(result) == 4  # 2 messages + 1 tool call + 1 tool output
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello, assistant!"
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == "Hello! How can I help you?"
        assert result[2]["type"] == "function_call"
        assert result[2]["name"] == "test_tool"
        assert result[3]["type"] == "function_call_output"

    def test_get_assistant_conversation_history_error(self):
        """Test get_assistant_conversation_history error handling."""
        # Test with empty messages and tool calls
        result = get_assistant_conversation_history([], [])
        assert result == []

        # Test with messages that have empty content
        chat_id = uuid.uuid4()
        messages = [
            AssistantMessages(
                id=uuid.uuid4(),
                chat_id=chat_id,
                role="user",
                content="",  # Empty content
                completed=True,
                created_at=datetime(2024, 1, 1, 10, 0, 0),
            ),
        ]

        result = get_assistant_conversation_history(messages, [])
        assert result == []

        # Test with tool calls that have None timestamps
        tool_calls = [
            AssistantToolCalls(
                id=uuid.uuid4(),
                chat_id=chat_id,
                tool_name="test_tool",
                tool_arguments=json.dumps({"param": "value"}),
                tool_result=json.dumps({"result": "success"}),
                created_at=None,  # None timestamp
            ),
        ]

        result = get_assistant_conversation_history([], tool_calls)
        assert len(result) == 2  # Should still include tool call and output


class TestGet_Chat_Scenario:
    """Tests for get_chat_scenario function."""

    def test_get_chat_scenario_success(self, mock_session):
        """Test successful get_chat_scenario execution."""
        # Create test data
        chat_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        
        chat = SimulationChats(
            id=chat_id,
            scenario_id=scenario_id,
            attempt_id=uuid.uuid4(),
            title="Test Chat",
            completed=False,
            created_at=datetime(2024, 1, 1, 10, 0, 0),
            updated_at=datetime(2024, 1, 1, 10, 0, 0),
        )

        scenario = Scenarios(
            id=scenario_id,
            name="Test Scenario",
            description="This is a test scenario for the chat.",
            persona_id=uuid.uuid4(),
            created_at=datetime(2024, 1, 1, 10, 0, 0),
            updated_at=datetime(2024, 1, 1, 10, 0, 0),
        )

        # Mock the session query
        mock_session.exec.return_value.one_or_none.return_value = scenario

        # Execute the function
        result = get_chat_scenario(chat, mock_session)

        # Verify the result
        assert result["role"] == "user"
        assert "This is a test scenario for the chat." in result["content"]
        assert "scenario for the chat" in result["content"]

        # Verify the session was called correctly
        mock_session.exec.assert_called_once()

    def test_get_chat_scenario_error(self, mock_session):
        """Test get_chat_scenario error handling."""
        # Create test data
        chat_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        
        chat = SimulationChats(
            id=chat_id,
            scenario_id=scenario_id,
            attempt_id=uuid.uuid4(),
            title="Test Chat",
            completed=False,
            created_at=datetime(2024, 1, 1, 10, 0, 0),
            updated_at=datetime(2024, 1, 1, 10, 0, 0),
        )

        # Mock the session query to return None (scenario not found)
        mock_session.exec.return_value.one_or_none.return_value = None

        # Execute the function and expect an error
        with pytest.raises(ValueError, match=f"Scenario not found for chat {chat.id}"):
            get_chat_scenario(chat, mock_session)

        # Verify the session was called correctly
        mock_session.exec.assert_called_once()
