"""
Tests for app.services.agents.generic
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from agents import Runner
from app.services.agents.generic import GenericAgent, run_generic_agent
from sqlmodel import Session


class MockPersona:
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


class TestRun_Generic_Agent:
    """Tests for run_generic_agent function."""

    @pytest.mark.asyncio
    async def test_run_generic_agent_success(self, mock_session):
        """Test successful run_generic_agent execution."""
        persona_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()
        
        mock_persona = MockPersona(
            persona_id, "Test Persona", "You are a helpful assistant", 0.7, model_id, "medium"
        )
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(provider_id, "openai", "encrypted_api_key")
        
        # Mock the database queries
        mock_session.exec.return_value.one.side_effect = [mock_persona, mock_model, mock_provider]
        
        # Mock the Runner.run_streamed
        mock_result = AsyncMock()
        mock_result.stream_events.return_value = [
            MagicMock(type="raw_response_event", data=MagicMock(delta="Hello"))
        ]
        
        with patch('app.services.agents.generic.Runner.run_streamed', return_value=mock_result):
            with patch('app.services.agents.generic.decrypt_api_key', return_value="decrypted_key"):
                with patch('app.services.agents.generic.trace'):
                    async for chunk in run_generic_agent(persona_id, [], mock_session):
                        assert chunk == "Hello"
                        break  # Just test the first chunk

    @pytest.mark.asyncio
    async def test_run_generic_agent_error(self, mock_session):
        """Test run_generic_agent error handling."""
        persona_id = uuid.uuid4()
        
        # Mock the database query to raise an error
        mock_session.exec.return_value.one.side_effect = Exception("Database error")
        
        with pytest.raises(Exception, match="Database error"):
            async for chunk in run_generic_agent(persona_id, [], mock_session):
                pass


class TestGenericAgent:
    """Tests for GenericAgent class."""

    def test_generic_agent_init_success(self):
        """Test successful GenericAgent initialization."""
        with patch('app.services.agents.generic.decrypt_api_key', return_value="decrypted_key"):
            agent = GenericAgent(
                agent_name="Test Agent",
                system_prompt="You are a helpful assistant",
                temperature=0.7,
                model_name="gpt-4",
                model_provider="openai",
                api_key="test_key",
                reasoning="medium"
            )
            
            assert agent.agent_name == "Test Agent"
            assert agent.system_prompt == "You are a helpful assistant"
            assert agent.temperature == 0.7
            assert agent.model == "openai/gpt-4"
            assert agent.api_key == "decrypted_key"

    def test_generic_agent_init_with_low_reasoning(self):
        """Test GenericAgent initialization with low reasoning."""
        with patch('app.services.agents.generic.decrypt_api_key', return_value="decrypted_key"):
            agent = GenericAgent(
                agent_name="Test Agent",
                system_prompt="You are a helpful assistant",
                temperature=0.7,
                model_name="gpt-4",
                model_provider="openai",
                api_key="test_key",
                reasoning="low"
            )
            
            assert agent.reasoning.effort == "low"

    def test_generic_agent_init_with_high_reasoning(self):
        """Test GenericAgent initialization with high reasoning."""
        with patch('app.services.agents.generic.decrypt_api_key', return_value="decrypted_key"):
            agent = GenericAgent(
                agent_name="Test Agent",
                system_prompt="You are a helpful assistant",
                temperature=0.7,
                model_name="gpt-4",
                model_provider="openai",
                api_key="test_key",
                reasoning="high"
            )
            
            assert agent.reasoning.effort == "high"

    def test_generic_agent_init_with_none_reasoning(self):
        """Test GenericAgent initialization with None reasoning."""
        with patch('app.services.agents.generic.decrypt_api_key', return_value="decrypted_key"):
            agent = GenericAgent(
                agent_name="Test Agent",
                system_prompt="You are a helpful assistant",
                temperature=0.7,
                model_name="gpt-4",
                model_provider="openai",
                api_key="test_key",
                reasoning=None
            )
            
            assert agent.reasoning.effort is None

    @patch('app.services.agents.generic.decrypt_api_key')
    def test_generic_agent_decrypts_api_key(self, mock_decrypt):
        """Test that GenericAgent decrypts the API key."""
        mock_decrypt.return_value = "decrypted_key"
        
        agent = GenericAgent(
            agent_name="Test Agent",
            system_prompt="You are a helpful assistant",
            temperature=0.7,
            model_name="gpt-4",
            model_provider="openai",
            api_key="encrypted_key",
            reasoning="medium"
        )
        
        mock_decrypt.assert_called_once_with("encrypted_key")
        assert agent.api_key == "decrypted_key"

    def test_generic_agent_creates_agent(self):
        """Test that GenericAgent creates an Agent instance."""
        with patch('app.services.agents.generic.decrypt_api_key', return_value="decrypted_key"):
            agent = GenericAgent(
                agent_name="Test Agent",
                system_prompt="You are a helpful assistant",
                temperature=0.7,
                model_name="gpt-4",
                model_provider="openai",
                api_key="test_key",
                reasoning="medium"
            )
            
            agent_instance = agent.agent()
            assert agent_instance.name == "Test Agent Agent"
            assert agent_instance.instructions == "You are a helpful assistant"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `agent`")
class TestAgent:
    """Tests for agent function."""

    def test_agent_success(self):
        """Test successful agent execution."""
        # TODO: Implement test for agent
        assert False, "IMPLEMENT: Test for agent"

    def test_agent_error(self):
        """Test agent error handling."""
        # TODO: Implement error test for agent
        assert False, "IMPLEMENT: Error test for agent"

