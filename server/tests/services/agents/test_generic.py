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
def sample_chat():
    """Create a sample simulation chat using MagicMock."""
    chat = MagicMock()
    chat.id = uuid4()
    chat.title = "Test Chat"
    chat.scenario_id = uuid4()
    chat.attempt_id = uuid4()
    chat.completed = False
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
def sample_messages():
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


class TestRunGenericAgent:
    """Tests for run_generic_agent function."""
    
    @patch('app.services.agents.generic.Runner')
    @patch('app.services.agents.generic.get_conversation_history')
    @patch('app.services.agents.generic.get_chat_scenario')
    @patch('app.services.agents.generic.get_class_info')
    async def test_run_generic_agent_success(self, mock_get_class_info, mock_get_chat_scenario, 
                                           mock_get_conversation_history, mock_runner, mock_session,
                                           sample_chat, sample_attempt, sample_agent, sample_messages):
        """Test successful run_generic_agent execution."""
        # Setup mocks
        mock_session.exec.side_effect = [
            MagicMock(one=MagicMock(return_value=sample_chat)),      # chat query
            MagicMock(one=MagicMock(return_value=sample_attempt)),   # attempt query
            MagicMock(one=MagicMock(return_value=sample_agent)),     # agent query
            MagicMock(all=MagicMock(return_value=sample_messages))   # messages query
        ]
        
        mock_get_conversation_history.return_value = ["Previous conversation"]
        mock_get_chat_scenario.return_value = "Test scenario"
        mock_get_class_info.return_value = "Class info"
        
        # Mock streaming response
        async def mock_stream_events():
            yield MagicMock(type="raw_response_event", data=MagicMock(delta="Hello"))
            yield MagicMock(type="raw_response_event", data=MagicMock(delta=" there"))
            yield MagicMock(type="raw_response_event", data=MagicMock(delta="!"))
        
        mock_result = MagicMock()
        mock_result.stream_events = mock_stream_events
        mock_runner.run_streamed.return_value = mock_result
        
        # Test the function
        result_tokens = []
        async for token in run_generic_agent(
            chat_id=str(sample_chat.id),
            input_text="Test input",
            test_data=False,
            session=mock_session
        ):
            result_tokens.append(token)
        
        # Verify results
        assert len(result_tokens) == 3
        assert result_tokens == ["Hello", " there", "!"]
        
        # Verify database operations
        assert mock_session.add.call_count == 2  # Initial empty message + final update
        mock_session.commit.assert_called()
        
        # Verify agent was created and run
        mock_runner.run_streamed.assert_called_once()
    
    async def test_run_generic_agent_test_data(self, mock_session):
        """Test run_generic_agent with test_data=True."""
        result_tokens = []
        async for token in run_generic_agent(
            chat_id=str(uuid4()),
            input_text="Test input",
            test_data=True,
            session=mock_session
        ):
            result_tokens.append(token)
        
        # Should return dummy response character by character
        full_response = "".join(result_tokens)
        assert "test response" in full_response.lower()
        assert "debugging purposes" in full_response.lower()
        
        # Verify database operations for test data
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
    
    @patch('app.services.agents.generic.Runner')
    async def test_run_generic_agent_error(self, mock_runner, mock_session, sample_chat, sample_attempt, sample_agent):
        """Test run_generic_agent error handling."""
        # Setup mocks
        mock_session.exec.side_effect = [
            MagicMock(one=MagicMock(return_value=sample_chat)),
            MagicMock(one=MagicMock(return_value=sample_attempt)),
            MagicMock(one=MagicMock(return_value=sample_agent)),
            MagicMock(all=MagicMock(return_value=[]))
        ]
        
        # Mock error in streaming
        mock_runner.run_streamed.side_effect = Exception("Test error")
        
        # Test error handling
        with pytest.raises(Exception, match="Test error"):
            result_tokens = []
            async for token in run_generic_agent(
                chat_id=str(sample_chat.id),
                input_text="Test input",
                test_data=False,
                session=mock_session
            ):
                result_tokens.append(token)


class TestGenericAgent:
    """Tests for GenericAgent class."""
    
    @patch('app.services.agents.generic.get_gemini')
    @patch('app.utils.agents.student_prompt')
    def test_generic_agent_student_init(self, mock_student_prompt, mock_get_gemini):
        """Test GenericAgent initialization for student type."""
        mock_student_prompt.return_value = "Student system prompt"
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
        assert agent.system_prompt == "Student system prompt"
        
        # Verify student_prompt was called
        mock_student_prompt.assert_called_once_with("Test Student", "You are a student")
    
    @patch('app.services.agents.generic.get_gemini')
    @patch('app.utils.agents.gta_prompt')
    def test_generic_agent_ta_init(self, mock_gta_prompt, mock_get_gemini):
        """Test GenericAgent initialization for TA type."""
        mock_gta_prompt.return_value = "TA system prompt"
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
        assert agent.system_prompt == "TA system prompt"
        
        # Verify gta_prompt was called
        mock_gta_prompt.assert_called_once_with("Test TA", "You are a TA")
    
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
    @patch('app.utils.agents.student_prompt')
    def test_student_agent_type_variations(self, mock_student_prompt, mock_get_gemini):
        """Test that student agent type is handled correctly."""
        mock_student_prompt.return_value = "Student prompt"
        mock_get_gemini.return_value = MagicMock()
        
        # Test exact match
        agent = GenericAgent("Test", "Prompt", "student", 0.5)
        assert agent.system_prompt == "Student prompt"
        mock_student_prompt.assert_called_with("Test", "Prompt")
    
    @patch('app.services.agents.generic.get_gemini')
    @patch('app.utils.agents.gta_prompt')
    def test_ta_agent_type_variations(self, mock_gta_prompt, mock_get_gemini):
        """Test that TA agent type is handled correctly."""
        mock_gta_prompt.return_value = "TA prompt"
        mock_get_gemini.return_value = MagicMock()
        
        # Test exact match
        agent = GenericAgent("Test", "Prompt", "ta", 0.5)
        assert agent.system_prompt == "TA prompt"
        mock_gta_prompt.assert_called_with("Test", "Prompt")
    
    @patch('app.services.agents.generic.get_gemini')
    def test_unknown_agent_type(self, mock_get_gemini):
        """Test handling of unknown agent types."""
        mock_get_gemini.return_value = MagicMock()
        
        agent = GenericAgent("Test", "Custom prompt", "unknown", 0.5)
        assert agent.system_prompt == "Custom prompt"  # Should fall back to agent_prompt

