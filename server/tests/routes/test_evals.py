"""
Tests for app.routes.evals

Auto-generated on: 2025-06-09T21:53:40.616021
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from uuid import uuid4, UUID
import json
import asyncio

# Import the router being tested
from app.routes.evals import _generate_natural_opening


@pytest.fixture
def mock_app():
    """Create a mock FastAPI app that doesn't import models."""
    from fastapi import FastAPI
    app = FastAPI()
    
    # Mock the database dependency
    def mock_get_session():
        return MagicMock()
    
    # Add our router with mocked dependencies
    from app.routes.evals import router
    app.include_router(router, prefix="/evals")
    
    return app


@pytest.fixture
def client(mock_app):
    """Create a test client for the mocked FastAPI app."""
    return TestClient(mock_app)


@pytest.fixture
def sample_eval_data():
    """Create sample eval data as dictionaries."""
    return {
        "id": uuid4(),
        "name": "Test Eval",
        "description": "Test evaluation",
        "scenario_ids": [uuid4(), uuid4()],
        "agent_ids": [uuid4(), uuid4()],
        "rubric_ids": [uuid4()],
        "max_turns": 5,
        "num_parallel_runs": 2,
        "base_agent_id": uuid4()
    }


@pytest.fixture
def sample_agents_data():
    """Create sample agent data as dictionaries."""
    return [
        {
            "id": uuid4(),
            "name": "Student Agent",
            "system_prompt": "You are a student",
            "agent_type": "student",
            "temperature": 7
        },
        {
            "id": uuid4(),
            "name": "TA Agent",
            "system_prompt": "You are a TA",
            "agent_type": "ta",
            "temperature": 3
        }
    ]


@pytest.fixture
def sample_scenarios_data():
    """Create sample scenario data as dictionaries."""
    return [
        {
            "id": uuid4(),
            "name": "Debug Problem",
            "description": "Help debug a null pointer exception",
            "agent_id": uuid4(),
            "crowdedness": 3,
            "intensity": 4,
            "seniority": "sophomore"
        }
    ]


@pytest.fixture
def sample_rubrics_data():
    """Create sample rubric data as dictionaries."""
    return [
        {
            "id": uuid4(),
            "name": "Student Performance Rubric",
            "description": "Evaluates student performance",
            "points": 100,
            "pass_points": 70
        }
    ]


class TestStartEval:
    """Tests for start_eval endpoint."""
    
    @patch('app.routes.evals.get_session')
    @patch('app.routes.evals.select')
    @patch('app.routes.evals.EvalRuns')
    def test_start_eval_success(self, mock_eval_runs_class, mock_select, mock_get_session, 
                               client, sample_eval_data, sample_agents_data, sample_scenarios_data, sample_rubrics_data):
        """Test successful start_eval request."""
        # Setup mock session
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session
        
        # Create mock objects from data
        eval_mock = MagicMock()
        for key, value in sample_eval_data.items():
            setattr(eval_mock, key, value)
        
        agent_mocks = []
        for agent_data in sample_agents_data:
            agent_mock = MagicMock()
            for key, value in agent_data.items():
                setattr(agent_mock, key, value)
            agent_mocks.append(agent_mock)
        
        scenario_mocks = []
        for scenario_data in sample_scenarios_data:
            scenario_mock = MagicMock()
            for key, value in scenario_data.items():
                setattr(scenario_mock, key, value)
            scenario_mocks.append(scenario_mock)
        
        rubric_mocks = []
        for rubric_data in sample_rubrics_data:
            rubric_mock = MagicMock()
            for key, value in rubric_data.items():
                setattr(rubric_mock, key, value)
            rubric_mocks.append(rubric_mock)
        
        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=eval_mock)),    # eval query
            MagicMock(all=MagicMock(return_value=scenario_mocks)),       # scenarios query
            MagicMock(all=MagicMock(return_value=agent_mocks)),          # agents query
            MagicMock(all=MagicMock(return_value=rubric_mocks))          # rubrics query
        ]
        
        # Mock eval run creation
        def mock_add(eval_run):
            eval_run.id = uuid4()
        
        mock_session.add.side_effect = mock_add
        mock_session.refresh.side_effect = lambda x: None
        
        # Make request
        response = client.post(
            "/evals/start",
            data={
                "eval_id": str(sample_eval_data["id"]),
                "class_id": str(uuid4())
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "eval_run_ids" in data
        assert data["total_runs"] > 0
        
        # Verify database operations
        mock_session.commit.assert_called()
        assert mock_session.add.call_count > 0
    
    @patch('app.routes.evals.get_session')
    def test_start_eval_not_found(self, mock_get_session, client):
        """Test start_eval with non-existent eval."""
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session
        
        # Mock eval not found
        mock_session.exec.return_value.one_or_none.return_value = None
        
        response = client.post(
            "/evals/start",
            data={
                "eval_id": str(uuid4()),
                "class_id": str(uuid4())
            }
        )
        
        assert response.status_code == 404
        assert "Evaluation not found" in response.json()["detail"]
    
    @patch('app.routes.evals.get_session')
    def test_start_eval_no_scenarios(self, mock_get_session, client, sample_eval_data):
        """Test start_eval with eval that has no scenarios."""
        sample_eval_data["scenario_ids"] = []
        
        eval_mock = MagicMock()
        for key, value in sample_eval_data.items():
            setattr(eval_mock, key, value)
        
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session
        mock_session.exec.return_value.one_or_none.return_value = eval_mock
        
        response = client.post(
            "/evals/start",
            data={
                "eval_id": str(sample_eval_data["id"]),
                "class_id": str(uuid4())
            }
        )
        
        assert response.status_code == 400
        assert "no scenarios configured" in response.json()["detail"]


class TestRunEval:
    """Tests for run_eval endpoint."""
    
    @patch('app.routes.evals.get_session')
    @patch('app.routes.evals.run_evaluate_agent')
    @patch('app.routes.evals.Runner')
    @patch('app.routes.evals.EvalChats')
    @patch('app.routes.evals.EvalMessages')
    def test_run_eval_success(self, mock_eval_messages_class, mock_eval_chats_class, 
                             mock_runner, mock_evaluate_agent, mock_get_session, 
                             client, sample_agents_data, sample_scenarios_data):
        """Test successful run_eval request."""
        # Setup mocks
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session
        
        # Create sample data using dictionaries and convert to mocks
        eval_run_data = {
            "id": uuid4(),
            "eval_id": uuid4(),
            "scenario_id": sample_scenarios_data[0]["id"],
            "query_agent_id": sample_agents_data[0]["id"],
            "response_agent_id": sample_agents_data[1]["id"],
            "class_id": uuid4(),
            "rubric_id": uuid4()
        }
        
        eval_run = MagicMock()
        for key, value in eval_run_data.items():
            setattr(eval_run, key, value)
        
        eval_data = {
            "id": eval_run_data["eval_id"],
            "name": "Test Eval",
            "max_turns": 3,
            "scenario_ids": [sample_scenarios_data[0]["id"]],
            "agent_ids": [sample_agents_data[0]["id"], sample_agents_data[1]["id"]],
            "rubric_ids": [uuid4()],
            "num_parallel_runs": 1,
            "base_agent_id": uuid4()
        }
        
        eval_obj = MagicMock()
        for key, value in eval_data.items():
            setattr(eval_obj, key, value)
        
        # Convert sample data to mocks
        scenario_mock = MagicMock()
        for key, value in sample_scenarios_data[0].items():
            setattr(scenario_mock, key, value)
        
        agent1_mock = MagicMock()
        for key, value in sample_agents_data[0].items():
            setattr(agent1_mock, key, value)
        
        agent2_mock = MagicMock()
        for key, value in sample_agents_data[1].items():
            setattr(agent2_mock, key, value)
        
        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=eval_run)),      # eval_run query
            MagicMock(one=MagicMock(return_value=eval_obj)),              # eval query
            MagicMock(one=MagicMock(return_value=scenario_mock)),         # scenario query
            MagicMock(one=MagicMock(return_value=agent1_mock)),           # query_agent query
            MagicMock(one=MagicMock(return_value=agent2_mock)),           # response_agent query
        ]
        
        # Mock eval chat creation
        def mock_add(obj):
            if hasattr(obj, 'id') and obj.id is None:
                obj.id = uuid4()
        
        mock_session.add.side_effect = mock_add
        mock_session.refresh.side_effect = lambda x: None
        
        # Mock agent streaming
        async def mock_stream_events():
            yield MagicMock(type="raw_response_event", data=MagicMock(delta="test"))
            yield MagicMock(type="raw_response_event", data=MagicMock(delta=" response"))
        
        mock_result = MagicMock()
        mock_result.stream_events = mock_stream_events
        mock_runner.run_streamed.return_value = mock_result
        
        # Mock evaluate agent
        mock_evaluate_agent.return_value = "grade_id_123"
        
        response = client.post(
            "/evals/run",
            data={"eval_run_id": str(eval_run_data["id"])}
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
    
    @patch('app.routes.evals.get_session')
    def test_run_eval_not_found(self, mock_get_session, client):
        """Test run_eval with non-existent eval run."""
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session
        mock_session.exec.return_value.one_or_none.return_value = None
        
        response = client.post(
            "/evals/run",
            data={"eval_run_id": str(uuid4())}
        )
        
        assert response.status_code == 404
        assert "Eval run not found" in response.json()["detail"]


class TestGenerateNaturalOpening:
    """Tests for _generate_natural_opening function."""
    
    def test_generate_student_opening(self, sample_scenarios_data, sample_agents_data):
        """Test natural opening generation for student agents."""
        scenario_mock = MagicMock()
        for key, value in sample_scenarios_data[0].items():
            setattr(scenario_mock, key, value)
        
        student_agent_mock = MagicMock()
        for key, value in sample_agents_data[0].items():
            setattr(student_agent_mock, key, value)
        
        opening = _generate_natural_opening(scenario_mock, student_agent_mock)
        
        assert isinstance(opening, str)
        assert len(opening) > 0
        assert sample_scenarios_data[0]["description"].lower() in opening.lower()
        # Should contain student-like language
        assert any(word in opening.lower() for word in ["trouble", "stuck", "help", "confused", "wrong"])
    
    def test_generate_ta_opening(self, sample_scenarios_data, sample_agents_data):
        """Test natural opening generation for TA agents."""
        scenario_mock = MagicMock()
        for key, value in sample_scenarios_data[0].items():
            setattr(scenario_mock, key, value)
        
        ta_agent_mock = MagicMock()
        for key, value in sample_agents_data[1].items():
            setattr(ta_agent_mock, key, value)
        
        opening = _generate_natural_opening(scenario_mock, ta_agent_mock)
        
        assert isinstance(opening, str)
        assert len(opening) > 0
        assert sample_scenarios_data[0]["description"].lower() in opening.lower()
        # Should contain TA-like language
        assert any(word in opening.lower() for word in ["help", "working", "questions", "together", "concern"])


class TestRunAgentConversation:
    """Tests for run_agent_conversation function."""
    
    @patch('app.routes.evals.Runner')
    @patch('app.services.agents.generic.GenericAgent')
    def test_run_agent_conversation_success(self, mock_generic_agent_class, mock_runner, 
                                          sample_agents_data, sample_scenarios_data):
        """Test successful agent conversation."""
        from app.routes.evals import run_agent_conversation
        
        # Setup mocks
        mock_session = MagicMock()
        mock_session.exec.return_value.all.return_value = []  # No previous messages
        
        async def mock_stream_events():
            yield MagicMock(type="raw_response_event", data=MagicMock(delta="Hello"))
            yield MagicMock(type="raw_response_event", data=MagicMock(delta=" there"))
        
        mock_result = MagicMock()
        mock_result.stream_events = mock_stream_events
        mock_runner.run_streamed.return_value = mock_result
        
        # Create agent instance mock
        agent_instance = MagicMock()
        agent_instance.agent.return_value = MagicMock()
        mock_generic_agent_class.return_value = agent_instance
        
        # Convert sample data to mocks
        scenario_mock = MagicMock()
        for key, value in sample_scenarios_data[0].items():
            setattr(scenario_mock, key, value)
        
        # Test the function
        result_tokens = []
        async def collect_tokens():
            async for token in run_agent_conversation(
                chat_id=str(uuid4()),
                input_message="Test message",
                agent_instance=agent_instance,
                agent_name=sample_agents_data[0]["name"],
                scenario=scenario_mock,
                session=mock_session
            ):
                result_tokens.append(token)
        
        asyncio.run(collect_tokens())
        
        assert len(result_tokens) == 2
        assert result_tokens == ["Hello", " there"]
        
        # Verify Runner was called
        mock_runner.run_streamed.assert_called_once()
    
    @patch('app.routes.evals.Runner')
    @patch('app.services.agents.generic.GenericAgent')
    def test_run_agent_conversation_error(self, mock_generic_agent_class, mock_runner, 
                                        sample_agents_data, sample_scenarios_data):
        """Test agent conversation error handling."""
        from app.routes.evals import run_agent_conversation
        
        # Setup error
        mock_runner.run_streamed.side_effect = Exception("Test error")
        
        agent_instance = MagicMock()
        mock_generic_agent_class.return_value = agent_instance
        
        scenario_mock = MagicMock()
        for key, value in sample_scenarios_data[0].items():
            setattr(scenario_mock, key, value)
        
        # Test error handling
        result_tokens = []
        async def collect_tokens():
            async for token in run_agent_conversation(
                chat_id=str(uuid4()),
                input_message="Test message",
                agent_instance=agent_instance,
                agent_name=sample_agents_data[0]["name"],
                scenario=scenario_mock,
                session=MagicMock()
            ):
                result_tokens.append(token)
        
        asyncio.run(collect_tokens())
        
        assert len(result_tokens) == 1
        assert "[Error: Test error]" in result_tokens[0]

