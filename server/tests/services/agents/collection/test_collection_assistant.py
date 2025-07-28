"""
Tests for app.services.agents.collection.assistant
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from agents import Runner
from app.services.agents.collection.assistant import (cancel_assistant_run,
                                                      run_assistant_agent)
from sqlmodel import Session


class MockAssistantChat:
    def __init__(self, id, title, profile_id, trace_id=None):
        self.id = id
        self.title = title
        self.profile_id = profile_id
        self.trace_id = trace_id or str(uuid.uuid4())


class MockProfile:
    def __init__(self, id, first_name, last_name, role):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.role = role


class MockAgent:
    def __init__(self, id, name, system_prompt, temperature, model_id, reasoning):
        self.id = id
        self.name = name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model_id = model_id
        self.reasoning = reasoning


class MockModel:
    def __init__(self, id, name, provider_id):
        self.id = id
        self.name = name
        self.provider_id = provider_id


class MockProvider:
    def __init__(self, id, name, api_key):
        self.id = id
        self.name = name
        self.api_key = api_key


class MockAssistantMessage:
    def __init__(self, id, chat_id, role, content, created_at=None):
        self.id = id
        self.chat_id = chat_id
        self.role = role
        self.content = content
        self.created_at = created_at or datetime.now()


class MockAssistantToolCall:
    def __init__(self, id, chat_id, tool_name, tool_type, tool_arguments, created_at=None):
        self.id = id
        self.chat_id = chat_id
        self.tool_name = tool_name
        self.tool_type = tool_type
        self.tool_arguments = tool_arguments
        self.created_at = created_at or datetime.now()


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestRun_Assistant_Agent:
    """Tests for run_assistant_agent function."""

    @pytest.mark.asyncio
    async def test_run_assistant_agent_success(self, mock_session):
        """Test successful run_assistant_agent execution."""
        chat_id = uuid.uuid4()
        profile_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()
        
        mock_chat = MockAssistantChat(chat_id, "Test Chat", profile_id)
        mock_profile = MockProfile(profile_id, "John", "Doe", "admin")
        mock_agent = MockAgent(agent_id, "Assistant", "You are helpful", 0.7, model_id, "medium")
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(provider_id, "openai", "dGVzdF9hcGlfa2V5")  # base64 encoded "test_api_key"
        
        # Mock the database queries
        mock_session.exec.return_value.one_or_none.return_value = mock_chat
        mock_session.exec.return_value.one.side_effect = [mock_agent, mock_profile, mock_model, mock_provider]
        mock_session.exec.return_value.all.return_value = []
        
        # Mock the Runner.run_streamed
        mock_result = AsyncMock()
        
        # Create an async generator for stream_events
        async def mock_stream_events():
            yield MagicMock(type="raw_response_event", data=MagicMock(delta="Hello"))
        
        mock_result.stream_events = mock_stream_events
        
        with patch('app.services.agents.collection.assistant.Runner.run_streamed', return_value=mock_result):
            with patch('app.services.agents.collection.assistant.MCPServerStreamableHttp') as mock_mcp:
                mock_mcp.return_value.__aenter__.return_value = MagicMock()
                with patch('app.services.agents.generic.decrypt_api_key', return_value="decrypted_key"):
                    with patch('app.services.agents.collection.assistant.trace') as mock_trace:
                        # Mock the trace context manager
                        mock_trace.return_value.__enter__ = MagicMock()
                        mock_trace.return_value.__exit__ = MagicMock()
                        async for chunk in run_assistant_agent(chat_id, mock_session):
                            assert chunk == "Hello"
                            break

    @pytest.mark.asyncio
    async def test_run_assistant_agent_error(self, mock_session):
        """Test run_assistant_agent error handling."""
        chat_id = uuid.uuid4()
        
        # Mock chat not found
        mock_session.exec.return_value.one_or_none.return_value = None
        
        with pytest.raises(ValueError, match="Chat not found"):
            async for chunk in run_assistant_agent(chat_id, mock_session):
                pass


class TestCancel_Assistant_Run:
    """Tests for cancel_assistant_run function."""

    def test_cancel_assistant_run_success(self, mock_session):
        """Test successful cancel_assistant_run execution."""
        chat_id = uuid.uuid4()
        
        # Mock the active run
        mock_run = MagicMock()
        mock_run.cancel.return_value = True
        
        with patch('app.main.cancel_active_run', return_value=True):
            result = cancel_assistant_run(chat_id)
            assert result is True

    def test_cancel_assistant_run_error(self, mock_session):
        """Test cancel_assistant_run error handling."""
        chat_id = uuid.uuid4()
        
        # Mock no active run found
        with patch('app.main.cancel_active_run', return_value=False):
            result = cancel_assistant_run(chat_id)
            assert result is False

    def test_cancel_assistant_run_invalid_uuid(self, mock_session):
        """Test cancel_assistant_run with invalid UUID."""
        # The function doesn't validate UUID format, so we'll test with a valid UUID
        # but mock the function to raise an error
        chat_id = "invalid-uuid"
        
        with patch('app.main.cancel_active_run', side_effect=ValueError("Invalid UUID")):
            with pytest.raises(ValueError):
                cancel_assistant_run(chat_id)
