"""
Tests for app.services.agents.collection.title
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from agents import Runner
from app.services.agents.collection.title import run_title_agent
from sqlmodel import Session


class MockAssistantChat:
    def __init__(self, id, title, profile_id, trace_id=None):
        self.id = id
        self.title = title
        self.profile_id = profile_id
        self.trace_id = trace_id or str(uuid.uuid4())


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


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestRun_Title_Agent:
    """Tests for run_title_agent function."""

    @pytest.mark.asyncio
    async def test_run_title_agent_success(self, mock_session):
        """Test successful run_title_agent execution."""
        chat_id = uuid.uuid4()
        profile_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()
        initial_message = "Hello, I need help with my assignment"
        
        mock_chat = MockAssistantChat(chat_id, "Test Chat", profile_id)
        mock_agent = MockAgent(agent_id, "Title", "Generate titles", 0.7, model_id, "medium")
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(provider_id, "openai", "dGVzdF9hcGlfa2V5")  # base64 encoded "test_api_key"
        
        # Mock the database queries
        mock_session.exec.return_value.one.side_effect = [mock_agent, mock_chat, mock_model, mock_provider]
        
        # Mock the Runner.run
        mock_result = MagicMock()
        mock_result.final_output = "Assignment Help Request"
        
        with patch('app.services.agents.collection.title.Runner.run', return_value=mock_result):
            with patch('app.services.agents.generic.decrypt_api_key', return_value="decrypted_key"):
                with patch('app.services.agents.collection.title.trace') as mock_trace:
                    # Mock the trace context manager
                    mock_trace.return_value.__enter__ = MagicMock()
                    mock_trace.return_value.__exit__ = MagicMock()
                    title = await run_title_agent(chat_id, initial_message, mock_session)
                    
                    assert title == "Assignment Help Request"

    @pytest.mark.asyncio
    async def test_run_title_agent_error(self, mock_session):
        """Test run_title_agent error handling."""
        chat_id = uuid.uuid4()
        initial_message = "Hello"
        
        # Mock agent not found
        mock_session.exec.return_value.one.side_effect = [None]
        
        with pytest.raises(ValueError, match="Title agent not found"):
            await run_title_agent(chat_id, initial_message, mock_session)
