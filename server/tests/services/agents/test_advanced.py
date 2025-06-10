"""
Tests for app.services.agents.advanced

Auto-generated on: 2025-06-10T16:21:22.289834
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4
import asyncio

# Import the module being tested
from app.services.agents.advanced import (
    run_advanced_agent_parallel,
    run_advanced_agent,
    _run_parallel_agent_turn,
    _parse_multi_output_response,
    AdvancedAgent,
    ParallelOutput
)

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)

@pytest.fixture
def sample_eval_chat():
    """Create a sample eval chat."""
    chat = MagicMock()
    chat.id = str(uuid4())
    chat.title = "Test Chat"
    chat.eval_run_id = str(uuid4())
    chat.completed_at = None
    return chat

@pytest.fixture
def sample_eval_run():
    """Create a sample eval run."""
    eval_run = MagicMock()
    eval_run.id = str(uuid4())
    eval_run.eval_id = str(uuid4())
    eval_run.agent_id = str(uuid4())
    eval_run.scenario_id = str(uuid4())
    eval_run.class_id = str(uuid4())
    eval_run.rubric_id = str(uuid4())
    return eval_run

@pytest.fixture
def sample_scenario():
    """Create a sample scenario."""
    scenario = MagicMock()
    scenario.id = str(uuid4())
    scenario.name = "Test Scenario"
    scenario.description = "A test scenario for debugging"
    scenario.agent_id = str(uuid4())
    return scenario

@pytest.fixture
def sample_agent():
    """Create a sample agent."""
    agent = MagicMock()
    agent.id = str(uuid4())
    agent.name = "Test Agent"
    agent.system_prompt = "You are a helpful assistant"
    agent.agent_type = "student"
    agent.temperature = 7
    return agent

@pytest.fixture
def sample_eval_obj():
    """Create a sample evaluation object."""
    eval_obj = MagicMock()
    eval_obj.id = str(uuid4())
    eval_obj.max_turns = 3
    eval_obj.num_parallel_runs = 2
    return eval_obj

@pytest.fixture
def sample_eval_run_chat_map(sample_eval_run, sample_scenario, sample_agent):
    """Create a sample eval run chat map."""
    chat_id = str(uuid4())
    return {
        chat_id: {
            'eval_run': sample_eval_run,
            'scenario': sample_scenario,
            'query_agent': sample_agent,
            'response_agent': sample_agent
        }
    }


class TestRunAdvancedAgentParallel:
    """Tests for run_advanced_agent_parallel function."""
    
    @pytest.mark.asyncio
    @patch('app.services.agents.evaluate.run_evaluate_agent')
    @patch('app.services.agents.advanced._run_parallel_agent_turn')
    async def test_run_advanced_agent_parallel_success(self, mock_parallel_turn, mock_evaluate, 
                                                      mock_session, sample_eval_obj, sample_eval_run_chat_map):
        """Test successful run_advanced_agent_parallel execution."""
        # Setup
        chat_ids = list(sample_eval_run_chat_map.keys())
        input_texts = ["Hello, I need help"]
        
        # Mock parallel agent turn
        mock_parallel_turn.return_value = ["Sure, I can help you!"]
        
        # Mock evaluate agent
        mock_evaluate.return_value = "grade_123"
        
        # Mock database operations
        mock_eval_chat = MagicMock()
        mock_session.exec.return_value.one.return_value = mock_eval_chat
        
        # Collect events
        events = []
        async for event in run_advanced_agent_parallel(
            chat_ids=chat_ids,
            input_texts=input_texts,
            eval_obj=sample_eval_obj,
            eval_run_chat_map=sample_eval_run_chat_map,
            session=mock_session
        ):
            events.append(event)
        
        # Verify events
        assert len(events) > 0
        
        # Check for expected event types
        event_types = [event['type'] for event in events]
        assert 'turn_start' in event_types
        assert 'token' in event_types
        assert 'turn_complete' in event_types
        assert 'conversation_complete' in event_types
        assert 'evaluation_complete' in event_types
        
        # Verify database operations
        mock_session.add.assert_called()
        mock_session.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_run_advanced_agent_parallel_empty_input(self, mock_session, sample_eval_obj):
        """Test run_advanced_agent_parallel with empty input."""
        events = []
        async for event in run_advanced_agent_parallel(
            chat_ids=[],
            input_texts=[],
            eval_obj=sample_eval_obj,
            eval_run_chat_map={},
            session=mock_session
        ):
            events.append(event)
        
        # Should handle empty input gracefully
        assert len(events) == 0


class TestRunParallelAgentTurn:
    """Tests for _run_parallel_agent_turn function."""
    
    @pytest.mark.asyncio
    @patch('app.services.agents.advanced.Runner')
    @patch('app.services.agents.advanced.AdvancedAgent')
    async def test_run_parallel_agent_turn_success(self, mock_agent_class, mock_runner, 
                                                  mock_session, sample_agent, sample_scenario):
        """Test successful _run_parallel_agent_turn execution."""
        # Setup
        chat_ids = [str(uuid4()), str(uuid4())]
        input_messages = ["Help with math", "Explain physics"]
        scenarios = [sample_scenario, sample_scenario]
        
        # Mock database queries
        mock_session.exec.return_value.all.return_value = []  # No previous messages
        
        # Mock agent instance
        mock_agent_instance = MagicMock()
        mock_agent_class.return_value = mock_agent_instance
        
        # Mock runner result with structured output
        mock_result = MagicMock()
        mock_result.outputs = ["Math help response", "Physics explanation"]
        mock_runner.run.return_value = mock_result
        
        # Test the function
        responses = await _run_parallel_agent_turn(
            chat_ids=chat_ids,
            input_messages=input_messages,
            scenarios=scenarios,
            agent=sample_agent,
            session=mock_session
        )
        
        # Verify responses
        assert len(responses) == 2
        assert responses[0] == "Math help response"
        assert responses[1] == "Physics explanation"
        
        # Verify agent was created with parallel output
        mock_agent_class.assert_called_once()
        call_kwargs = mock_agent_class.call_args[1]
        assert call_kwargs['use_parallel_output'] is True
    
    @pytest.mark.asyncio
    @patch('app.services.agents.advanced.Runner')
    @patch('app.services.agents.advanced.AdvancedAgent')
    @patch('app.services.agents.advanced._parse_multi_output_response')
    async def test_run_parallel_agent_turn_fallback_parsing(self, mock_parse, mock_agent_class, 
                                                           mock_runner, mock_session, sample_agent, sample_scenario):
        """Test _run_parallel_agent_turn with fallback text parsing."""
        # Setup
        chat_ids = [str(uuid4())]
        input_messages = ["Help me"]
        scenarios = [sample_scenario]
        
        # Mock database queries
        mock_session.exec.return_value.all.return_value = []
        
        # Mock agent instance
        mock_agent_instance = MagicMock()
        mock_agent_class.return_value = mock_agent_instance
        
        # Mock runner result without structured output
        mock_result = MagicMock()
        mock_result.outputs = None
        mock_runner.run.return_value = mock_result
        
        # Mock text parsing
        mock_parse.return_value = ["Parsed response"]
        
        # Test the function
        responses = await _run_parallel_agent_turn(
            chat_ids=chat_ids,
            input_messages=input_messages,
            scenarios=scenarios,
            agent=sample_agent,
            session=mock_session
        )
        
        # Verify fallback parsing was used
        mock_parse.assert_called_once()
        assert responses == ["Parsed response"]
    
    @pytest.mark.asyncio
    @patch('app.services.agents.advanced.Runner')
    @patch('app.services.agents.advanced.AdvancedAgent')
    async def test_run_parallel_agent_turn_error_handling(self, mock_agent_class, mock_runner, 
                                                         mock_session, sample_agent, sample_scenario):
        """Test _run_parallel_agent_turn error handling."""
        # Setup
        chat_ids = [str(uuid4())]
        input_messages = ["Help me"]
        scenarios = [sample_scenario]
        
        # Mock error
        mock_runner.run.side_effect = Exception("Test error")
        
        # Test error handling
        responses = await _run_parallel_agent_turn(
            chat_ids=chat_ids,
            input_messages=input_messages,
            scenarios=scenarios,
            agent=sample_agent,
            session=mock_session
        )
        
        # Should return error responses
        assert len(responses) == 1
        assert "[Error: Test error]" in responses[0]


class TestParseMultiOutputResponse:
    """Tests for _parse_multi_output_response function."""
    
    def test_parse_multi_output_response_success(self):
        """Test successful parsing of multi-output response."""
        response_text = """
        OUTPUT 1: This is the first response about math.
        OUTPUT 2: This is the second response about physics.
        OUTPUT 3: This is the third response about chemistry.
        """
        
        outputs = _parse_multi_output_response(response_text, 3)
        
        assert len(outputs) == 3
        assert "first response about math" in outputs[0]
        assert "second response about physics" in outputs[1]
        assert "third response about chemistry" in outputs[2]
    
    def test_parse_multi_output_response_case_insensitive(self):
        """Test parsing with different case patterns."""
        response_text = """
        output 1: First response
        Output 2: Second response
        OUTPUT 3: Third response
        """
        
        outputs = _parse_multi_output_response(response_text, 3)
        
        assert len(outputs) == 3
        assert "First response" in outputs[0]
        assert "Second response" in outputs[1]
        assert "Third response" in outputs[2]
    
    def test_parse_multi_output_response_fallback_lines(self):
        """Test fallback parsing by lines when OUTPUT pattern not found."""
        response_text = """
        First line response
        Second line response
        Third line response
        """
        
        outputs = _parse_multi_output_response(response_text, 3)
        
        assert len(outputs) == 3
        assert outputs[0] == "First line response"
        assert outputs[1] == "Second line response"
        assert outputs[2] == "Third line response"
    
    def test_parse_multi_output_response_insufficient_outputs(self):
        """Test handling when fewer outputs than expected."""
        response_text = "OUTPUT 1: Only one response"
        
        outputs = _parse_multi_output_response(response_text, 3)
        
        assert len(outputs) == 3
        assert "Only one response" in outputs[0]
        # Should pad with default responses - check the actual fallback behavior
        assert "Response 2" in outputs[1] or "I apologize" in outputs[1]
        assert "Response 3" in outputs[2] or "I apologize" in outputs[2]
    
    def test_parse_multi_output_response_empty_input(self):
        """Test handling of empty input."""
        outputs = _parse_multi_output_response("", 2)
        
        assert len(outputs) == 2
        # Should return default responses
        assert "I understand your question 1" in outputs[0]
        assert "I understand your question 2" in outputs[1]


class TestRunAdvancedAgent:
    """Tests for run_advanced_agent function."""
    
    @pytest.mark.asyncio
    @patch('app.services.agents.advanced._handle_single_eval_chat')
    async def test_run_advanced_agent_success(self, mock_handle_chat, mock_session, sample_eval_chat):
        """Test successful run_advanced_agent execution."""
        # Setup
        mock_session.exec.return_value.one_or_none.return_value = sample_eval_chat
        
        # Mock chat handler
        async def mock_token_generator():
            yield "Hello"
            yield " world"
        
        mock_handle_chat.return_value = mock_token_generator()
        
        # Test the function
        tokens = []
        async for token in run_advanced_agent(
            chat_id=sample_eval_chat.id,
            input_text="Test input",
            session=mock_session
        ):
            tokens.append(token)
        
        # Verify results
        assert tokens == ["Hello", " world"]
        mock_handle_chat.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_run_advanced_agent_chat_not_found(self, mock_session):
        """Test run_advanced_agent when chat is not found."""
        # Setup
        mock_session.exec.return_value.one_or_none.return_value = None
        
        # Test error handling
        with pytest.raises(ValueError, match="Chat not found with ID"):
            async for token in run_advanced_agent(
                chat_id=str(uuid4()),
                input_text="Test input",
                session=mock_session
            ):
                pass


class TestAdvancedAgent:
    """Tests for AdvancedAgent class."""
    
    @patch('app.services.agents.advanced.get_gemini')
    @patch('app.services.agents.advanced.gta_prompt')
    def test_advanced_agent_ta_init(self, mock_gta_prompt, mock_get_gemini):
        """Test AdvancedAgent initialization for TA type."""
        mock_get_gemini.return_value = MagicMock()
        mock_gta_prompt.return_value = "TA system prompt"
        
        agent = AdvancedAgent(
            agent_name="Test TA",
            agent_prompt="You are a TA",
            agent_type="ta",
            temperature=0.3
        )
        
        assert agent.agent_name == "Test TA"
        assert agent.agent_prompt == "You are a TA"
        assert agent.temperature == 0.3
        assert agent.system_prompt == "TA system prompt"
        mock_gta_prompt.assert_called_once_with("Test TA", "You are a TA")
    
    @patch('app.services.agents.advanced.get_gemini')
    @patch('app.services.agents.advanced.student_prompt')
    def test_advanced_agent_student_init(self, mock_student_prompt, mock_get_gemini):
        """Test AdvancedAgent initialization for student type."""
        mock_get_gemini.return_value = MagicMock()
        mock_student_prompt.return_value = "Student system prompt"
        
        agent = AdvancedAgent(
            agent_name="Test Student",
            agent_prompt="You are a student",
            agent_type="student",
            temperature=0.7,
            use_parallel_output=True
        )
        
        assert agent.agent_name == "Test Student"
        assert agent.use_parallel_output is True
        assert agent.system_prompt == "Student system prompt"
        mock_student_prompt.assert_called_once_with("Test Student", "You are a student")
    
    @patch('app.services.agents.advanced.get_gemini')
    def test_advanced_agent_default_init(self, mock_get_gemini):
        """Test AdvancedAgent initialization for default type."""
        mock_get_gemini.return_value = MagicMock()
        
        agent = AdvancedAgent(
            agent_name="Test Agent",
            agent_prompt="You are an agent",
            agent_type="default",
            temperature=0.5
        )
        
        assert agent.system_prompt == "You are an agent"  # Should use agent_prompt directly
    
    @patch('app.services.agents.advanced.get_gemini')
    @patch('app.services.agents.advanced.Agent')
    def test_advanced_agent_agent_method_without_parallel(self, mock_agent_class, mock_get_gemini):
        """Test AdvancedAgent.agent() method without parallel output."""
        mock_get_gemini.return_value = MagicMock()
        
        agent = AdvancedAgent(
            agent_name="Test Agent",
            agent_prompt="Test prompt",
            agent_type="default",
            temperature=0.8,
            use_parallel_output=False
        )
        
        # Call the agent method
        result = agent.agent()
        
        # Verify Agent was created without output_type
        mock_agent_class.assert_called_once()
        call_kwargs = mock_agent_class.call_args[1]
        assert 'output_type' not in call_kwargs
        assert call_kwargs['name'] == "Test Agent Agent"
    
    @patch('app.services.agents.advanced.get_gemini')
    @patch('app.services.agents.advanced.Agent')
    def test_advanced_agent_agent_method_with_parallel(self, mock_agent_class, mock_get_gemini):
        """Test AdvancedAgent.agent() method with parallel output."""
        mock_get_gemini.return_value = MagicMock()
        
        agent = AdvancedAgent(
            agent_name="Test Agent",
            agent_prompt="Test prompt",
            agent_type="default",
            temperature=0.8,
            use_parallel_output=True
        )
        
        # Call the agent method
        result = agent.agent()
        
        # Verify Agent was created with output_type
        mock_agent_class.assert_called_once()
        call_kwargs = mock_agent_class.call_args[1]
        assert call_kwargs['output_type'] == ParallelOutput


class TestParallelOutput:
    """Tests for ParallelOutput model."""
    
    def test_parallel_output_creation(self):
        """Test ParallelOutput model creation."""
        outputs = ["Response 1", "Response 2", "Response 3"]
        parallel_output = ParallelOutput(outputs=outputs)
        
        assert parallel_output.outputs == outputs
        assert len(parallel_output.outputs) == 3
    
    def test_parallel_output_empty(self):
        """Test ParallelOutput with empty list."""
        parallel_output = ParallelOutput(outputs=[])
        
        assert parallel_output.outputs == []
        assert len(parallel_output.outputs) == 0

