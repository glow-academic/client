"""
Tests for app.services.agents.generic

Auto-generated on: 2025-06-09T21:53:40.621649
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4

# Import the module being tested
from app.services.agents.generic import run_generic_agent, GenericAgent

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)

@pytest.fixture
def sample_simulation_chat():
    """Create a sample simulation chat using MagicMock."""
    chat = MagicMock()
    chat.id = uuid4()
    chat.title = "Test Simulation Chat"
    chat.scenario_id = uuid4()
    chat.attempt_id = uuid4()
    chat.completed = False
    return chat

@pytest.fixture
def sample_eval_chat():
    """Create a sample eval chat using MagicMock."""
    chat = MagicMock()
    chat.id = uuid4()
    chat.title = "Test Eval Chat"
    chat.eval_run_id = uuid4()
    chat.completed_at = None
    return chat

@pytest.fixture
def sample_attempt():
    """Create a sample simulation attempt using MagicMock."""
    attempt = MagicMock()
    attempt.id = uuid4()
    attempt.class_id = uuid4()
    attempt.simulation_id = uuid4()
    attempt.user_id = uuid4()
    return attempt

@pytest.fixture
def sample_eval_run():
    """Create a sample eval run using MagicMock."""
    eval_run = MagicMock()
    eval_run.id = uuid4()
    eval_run.class_id = uuid4()
    eval_run.eval_id = uuid4()
    eval_run.agent_id = uuid4()
    eval_run.scenario_id = uuid4()
    eval_run.rubric_id = uuid4()
    return eval_run

@pytest.fixture
def sample_scenario():
    """Create a sample scenario using MagicMock."""
    scenario = MagicMock()
    scenario.id = uuid4()
    scenario.name = "Test Scenario"
    scenario.description = "A test scenario"
    scenario.agent_id = uuid4()
    return scenario

@pytest.fixture
def sample_agent():
    """Create a sample agent using MagicMock."""
    agent = MagicMock()
    agent.id = uuid4()
    agent.name = "Test Student"
    agent.system_prompt = "You are a helpful student"
    agent.agent_type = "student"
    agent.temperature = 7
    return agent

@pytest.fixture
def sample_ta_agent():
    """Create a sample TA agent using MagicMock."""
    agent = MagicMock()
    agent.id = uuid4()
    agent.name = "Test TA"
    agent.system_prompt = "You are a helpful teaching assistant"
    agent.agent_type = "ta"
    agent.temperature = 3
    return agent

@pytest.fixture
def sample_simulation_messages():
    """Create sample simulation messages using MagicMock."""
    message1 = MagicMock()
    message1.id = uuid4()
    message1.chat_id = uuid4()
    message1.query = "Hello, I need help"
    message1.response = "Sure, I can help you"
    message1.completed = True
    
    message2 = MagicMock()
    message2.id = uuid4()
    message2.chat_id = uuid4()
    message2.query = "What is a variable?"
    message2.response = "A variable is a storage location"
    message2.completed = True
    
    return [message1, message2]

@pytest.fixture
def sample_eval_messages():
    """Create sample eval messages using MagicMock."""
    message1 = MagicMock()
    message1.id = uuid4()
    message1.chat_id = uuid4()
    message1.query = "Explain this concept"
    message1.response = "Here's the explanation"
    message1.completed = True
    
    message2 = MagicMock()
    message2.id = uuid4()
    message2.chat_id = uuid4()
    message2.query = "Can you elaborate?"
    message2.response = "Certainly, let me elaborate"
    message2.completed = True
    
    return [message1, message2]


class TestRunGenericAgent:
    """Tests for run_generic_agent function."""
    
    @pytest.mark.asyncio
    async def test_run_generic_agent_simulation_success(self, mock_session, sample_simulation_chat):
        """Test successful run_generic_agent execution with simulation chat."""
        # Setup mock to return simulation chat
        mock_session.exec.return_value.one_or_none.return_value = sample_simulation_chat
        
        # Test the function with test_data=True to avoid complex mocking
        result_tokens = []
        async for token in run_generic_agent(
            chat_id=str(sample_simulation_chat.id),
            input_text="Test input",
            test_data=True,
            session=mock_session
        ):
            result_tokens.append(token)
        
        # Should return dummy response
        full_response = "".join(result_tokens)
        assert "test response" in full_response.lower()
        
        # Verify database operations
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_generic_agent_eval_success(self, mock_session, sample_eval_chat):
        """Test successful run_generic_agent execution with eval chat."""
        # Setup mocks for eval chat path (simulation chat returns None, eval chat returns the chat)
        mock_session.exec.return_value.one_or_none.side_effect = [None, sample_eval_chat]
        
        # Test the function with test_data=True to avoid complex mocking
        result_tokens = []
        async for token in run_generic_agent(
            chat_id=str(sample_eval_chat.id),
            input_text="Test eval input",
            test_data=True,
            session=mock_session
        ):
            result_tokens.append(token)
        
        # Should return dummy response
        full_response = "".join(result_tokens)
        assert "test response" in full_response.lower()
        
        # Verify database operations
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_run_generic_agent_chat_not_found(self, mock_session):
        """Test run_generic_agent when chat is not found."""
        # Setup mocks to return None for both chat types
        mock_session.exec.return_value.one_or_none.return_value = None
        
        # Test error handling
        with pytest.raises(ValueError, match="Chat not found with ID"):
            result_tokens = []
            async for token in run_generic_agent(
                chat_id=str(uuid4()),
                input_text="Test input",
                session=mock_session
            ):
                result_tokens.append(token)

    @pytest.mark.asyncio
    async def test_run_generic_agent_simulation_error(self, mock_session, sample_simulation_chat):
        """Test run_generic_agent error handling in simulation chat."""
        # Setup mock to return simulation chat but then fail
        mock_session.exec.return_value.one_or_none.return_value = sample_simulation_chat
        mock_session.exec.return_value.one.side_effect = Exception("Database error")
        
        # Test error handling
        with pytest.raises(Exception, match="Database error"):
            result_tokens = []
            async for token in run_generic_agent(
                chat_id=str(sample_simulation_chat.id),
                input_text="Test input",
                test_data=False,
                session=mock_session
            ):
                result_tokens.append(token)


class TestGenericAgent:
    """Tests for GenericAgent class."""
    
    @patch('app.services.agents.generic.get_gemini')
    def test_generic_agent_student_init(self, mock_get_gemini):
        """Test GenericAgent initialization for student type."""
        mock_get_gemini.return_value = MagicMock()
        
        agent = GenericAgent(
            agent_name="Test Student",
            agent_prompt="You are a student",
            agent_type="student",
            temperature=0.7
        )
        
        assert agent.agent_name == "Test Student"
        assert agent.agent_prompt == "You are a student"
        assert agent.temperature == 0.7
        # The system prompt should be generated by student_prompt function
        assert "student" in agent.system_prompt.lower()
    
    @patch('app.services.agents.generic.get_gemini')
    def test_generic_agent_ta_init(self, mock_get_gemini):
        """Test GenericAgent initialization for TA type."""
        mock_get_gemini.return_value = MagicMock()
        
        agent = GenericAgent(
            agent_name="Test TA",
            agent_prompt="You are a TA",
            agent_type="ta",
            temperature=0.3
        )
        
        assert agent.agent_name == "Test TA"
        assert agent.agent_prompt == "You are a TA"
        assert agent.temperature == 0.3
        # The system prompt should be generated by gta_prompt function
        assert "teaching assistant" in agent.system_prompt.lower()
    
    @patch('app.services.agents.generic.get_gemini')
    def test_generic_agent_default_init(self, mock_get_gemini):
        """Test GenericAgent initialization for default type."""
        mock_get_gemini.return_value = MagicMock()
        
        agent = GenericAgent(
            agent_name="Test Agent",
            agent_prompt="You are an agent",
            agent_type="default",
            temperature=0.5
        )
        
        assert agent.agent_name == "Test Agent"
        assert agent.agent_prompt == "You are an agent"
        assert agent.temperature == 0.5
        assert agent.system_prompt == "You are an agent"  # Should use agent_prompt directly
    
    @patch('app.services.agents.generic.get_gemini')
    @patch('app.services.agents.generic.Agent')
    def test_generic_agent_agent_method(self, mock_agent_class, mock_get_gemini):
        """Test GenericAgent.agent() method."""
        mock_gemini_client = MagicMock()
        mock_get_gemini.return_value = mock_gemini_client
        
        agent = GenericAgent(
            agent_name="Test Agent",
            agent_prompt="You are an agent",
            agent_type="default",
            temperature=0.8
        )
        
        # Call the agent method
        result = agent.agent()
        
        # Verify Agent was created with correct parameters
        mock_agent_class.assert_called_once()
        call_args = mock_agent_class.call_args
        
        assert call_args[1]['name'] == "Test Agent Agent"
        assert call_args[1]['instructions'] == "You are an agent"
        assert call_args[1]['model_settings'].temperature == 0.8
    
    def test_generic_agent_temperature_conversion(self):
        """Test that temperature is handled correctly."""
        with patch('app.services.agents.generic.get_gemini'):
            agent = GenericAgent(
                agent_name="Test",
                agent_prompt="Test",
                agent_type="default",
                temperature=5  # Integer input
            )
            assert agent.temperature == 5
            
            agent2 = GenericAgent(
                agent_name="Test",
                agent_prompt="Test", 
                agent_type="default",
                temperature=0.7  # Float input
            )
            assert agent2.temperature == 0.7


class TestAgentTypeHandling:
    """Tests for different agent type handling."""
    
    @patch('app.services.agents.generic.get_gemini')
    def test_student_agent_type_variations(self, mock_get_gemini):
        """Test that student agent type is handled correctly."""
        mock_get_gemini.return_value = MagicMock()
        
        # Test exact match
        agent = GenericAgent("Test", "Prompt", "student", 0.5)
        assert "student" in agent.system_prompt.lower()
    
    @patch('app.services.agents.generic.get_gemini')
    def test_ta_agent_type_variations(self, mock_get_gemini):
        """Test that TA agent type is handled correctly."""
        mock_get_gemini.return_value = MagicMock()
        
        # Test exact match
        agent = GenericAgent("Test", "Prompt", "ta", 0.5)
        assert "teaching assistant" in agent.system_prompt.lower()
    
    @patch('app.services.agents.generic.get_gemini')
    def test_unknown_agent_type(self, mock_get_gemini):
        """Test handling of unknown agent types."""
        mock_get_gemini.return_value = MagicMock()
        
        agent = GenericAgent("Test", "Custom prompt", "unknown", 0.5)
        assert agent.system_prompt == "Custom prompt"  # Should fall back to agent_prompt




