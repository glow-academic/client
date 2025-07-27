"""
Tests for app.routes.scenarios
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from app.main import app

    return TestClient(app)


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestNew_Scenario:
    """Tests for new_scenario endpoint."""

    @patch("app.routes.scenarios.run_scenario_agent")
    def test_new_scenario_success(self, mock_run_agent, client, mock_session):
        """Test successful new_scenario request."""
        persona_id = uuid4()
        document_ids = [uuid4(), uuid4()]
        parameter_item_ids = [uuid4()]
        
        # Mock the scenario agent response
        mock_run_agent.return_value = ("Test Scenario Title", "Test scenario description", None)
        
        # Create form data
        data = {
            "persona_id": str(persona_id),
            "document_ids": [str(doc_id) for doc_id in document_ids],
            "parameter_item_ids": [str(param_id) for param_id in parameter_item_ids]
        }
        
        response = client.post("/scenarios/new", data=data)
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["title"] == "Test Scenario Title"
        assert response.json()["description"] == "Test scenario description"
        
        # Verify the agent was called with correct parameters
        mock_run_agent.assert_called_once_with(
            persona_id=persona_id,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
            group_id=None,
            session=mock_session
        )

    @patch("app.routes.scenarios.run_scenario_agent")
    def test_new_scenario_with_no_optional_params(self, mock_run_agent, client, mock_session):
        """Test new_scenario with no optional parameters."""
        # Mock the scenario agent response
        mock_run_agent.return_value = ("Default Title", "Default description", None)
        
        # Create form data with only required fields (none are required)
        data = {}
        
        response = client.post("/scenarios/new", data=data)
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Verify the agent was called with None values
        mock_run_agent.assert_called_once_with(
            persona_id=None,
            document_ids=None,
            parameter_item_ids=None,
            group_id=None,
            session=mock_session
        )

    @patch("app.routes.scenarios.run_scenario_agent")
    def test_new_scenario_error(self, mock_run_agent, client, mock_session):
        """Test new_scenario error handling."""
        # Mock the scenario agent to raise an exception
        mock_run_agent.side_effect = Exception("Agent failed")
        
        data = {"persona_id": str(uuid4())}
        
        response = client.post("/scenarios/new", data=data)
        
        assert response.status_code == 500
        assert "Failed to generate new scenario" in response.json()["detail"]

    @patch("app.routes.scenarios.run_scenario_agent")
    def test_new_scenario_with_empty_document_ids(self, mock_run_agent, client, mock_session):
        """Test new_scenario with empty document IDs."""
        persona_id = uuid4()
        
        # Mock the scenario agent response
        mock_run_agent.return_value = ("Test Title", "Test description", None)
        
        # Create form data with empty document IDs
        data = {
            "persona_id": str(persona_id),
            "document_ids": ["", ""],  # Empty strings should be filtered out
            "parameter_item_ids": []
        }
        
        response = client.post("/scenarios/new", data=data)
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Verify the agent was called with None for document_ids (filtered out)
        mock_run_agent.assert_called_once_with(
            persona_id=persona_id,
            document_ids=None,  # Should be None after filtering
            parameter_item_ids=[],
            group_id=None,
            session=mock_session
        )


class TestTest_Scenario:
    """Tests for test_scenario endpoint."""

    @patch("app.routes.scenarios.run_generic_agent")
    def test_test_scenario_success(self, mock_run_agent, client, mock_session):
        """Test successful test_scenario request."""
        persona_id = uuid4()
        description = "Test scenario description"
        query = "What should I do?"
        
        # Mock the streaming response
        mock_run_agent.return_value = AsyncMock()
        mock_run_agent.return_value.__aiter__.return_value = iter(["Hello", " world"])
        
        data = {
            "persona_id": str(persona_id),
            "description": description,
            "query": query
        }
        
        response = client.post("/scenarios/test", data=data)
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        assert response.headers["cache-control"] == "no-store"

    @patch("app.routes.scenarios.run_generic_agent")
    def test_test_scenario_without_description(self, mock_run_agent, client, mock_session):
        """Test test_scenario without description."""
        persona_id = uuid4()
        query = "What should I do?"
        
        # Mock the streaming response
        mock_run_agent.return_value = AsyncMock()
        mock_run_agent.return_value.__aiter__.return_value = iter(["Response"])
        
        data = {
            "persona_id": str(persona_id),
            "description": "",  # Empty description
            "query": query
        }
        
        response = client.post("/scenarios/test", data=data)
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"

    def test_test_scenario_missing_persona_id(self, client, mock_session):
        """Test test_scenario error handling - missing persona_id."""
        data = {
            "description": "Test description",
            "query": "What should I do?"
        }
        
        response = client.post("/scenarios/test", data=data)
        
        assert response.status_code == 400
        assert "Persona ID is required" in response.json()["detail"]

    def test_test_scenario_missing_query(self, client, mock_session):
        """Test test_scenario error handling - missing query."""
        persona_id = uuid4()
        
        data = {
            "persona_id": str(persona_id),
            "description": "Test description",
            "query": ""  # Empty query
        }
        
        response = client.post("/scenarios/test", data=data)
        
        assert response.status_code == 400
        assert "Query is required" in response.json()["detail"]

    @patch("app.routes.scenarios.run_generic_agent")
    def test_test_scenario_agent_error(self, mock_run_agent, client, mock_session):
        """Test test_scenario error handling - agent failure."""
        persona_id = uuid4()
        query = "What should I do?"
        
        # Mock the agent to raise an exception
        mock_run_agent.side_effect = Exception("Agent failed")
        
        data = {
            "persona_id": str(persona_id),
            "description": "Test description",
            "query": query
        }
        
        response = client.post("/scenarios/test", data=data)
        
        assert response.status_code == 500
        assert "Failed to process test query" in response.json()["detail"]

    @patch("app.routes.scenarios.run_generic_agent")
    def test_test_scenario_streaming_content(self, mock_run_agent, client, mock_session):
        """Test test_scenario streaming content structure."""
        persona_id = uuid4()
        query = "What should I do?"
        
        # Mock the streaming response with specific tokens
        mock_run_agent.return_value = AsyncMock()
        mock_run_agent.return_value.__aiter__.return_value = iter(["Hello", " world", "!"])
        
        data = {
            "persona_id": str(persona_id),
            "description": "Test description",
            "query": query
        }
        
        response = client.post("/scenarios/test", data=data)
        
        assert response.status_code == 200
        # The response should be a streaming response with Server-Sent Events format
        assert "text/event-stream" in response.headers["content-type"]
