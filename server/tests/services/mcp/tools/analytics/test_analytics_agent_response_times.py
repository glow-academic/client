# test_agent_response_times.py

import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy.exc import SQLAlchemyError
from app.services.mcp.tools.analytics.agent_response_times import agent_response_times


# Use MagicMock to simulate SQLModel objects, as they won't be coming from a real DB
class MockAgent:
    def __init__(self, id, name, description):
        self.id = id
        self.name = name
        self.description = description


class MockScenario:
    def __init__(self, id, name, agent_id):
        self.id = id
        self.name = name
        self.agent_id = agent_id


class MockChat:
    def __init__(self, id, scenario_id, created_at):
        self.id = id
        self.scenario_id = scenario_id
        self.created_at = created_at


class MockMessage:
    def __init__(self, chat_id, type, content, created_at):
        self.id = uuid.uuid4()
        self.chat_id = chat_id
        self.type = type
        self.content = content
        self.created_at = created_at


@pytest.fixture
def mock_db_session():
    """Provides a fully mocked database session."""
    return MagicMock()


@patch("app.services.mcp.tools.analytics.agent_response_times.get_session")
class TestAgentResponseTimes:
    """Tests for agent_response_times function using a mocked session."""

    def test_success_with_data(self, mock_get_session, mock_db_session):
        """Test successful execution with mocked data."""
        # Arrange
        mock_get_session.return_value = iter([mock_db_session])
        agent_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        chat_id = uuid.uuid4()

        # 1. Configure mock for fetching the agent
        mock_agent = MockAgent(id=agent_id, name="Test Agent", description="...")
        mock_db_session.get.return_value = mock_agent

        # 2. Configure mock for fetching scenarios
        mock_scenario = MockScenario(
            id=scenario_id, name="Test Scenario", agent_id=agent_id
        )

        # 3. Configure mock for fetching chats and messages
        time_now = datetime.now()
        messages = [
            MockMessage(chat_id, "query", "Q1", time_now - timedelta(seconds=10)),
            MockMessage(
                chat_id, "response", "A1", time_now - timedelta(seconds=5)
            ),  # 5s
            MockMessage(chat_id, "query", "Q2", time_now - timedelta(seconds=4)),
            MockMessage(chat_id, "response", "A2", time_now),  # 4s
        ]

        # Mocks must be configured to return values for each `session.exec` call
        # We can use side_effect to return different values on subsequent calls
        mock_exec_chain = MagicMock()
        mock_exec_chain.all.side_effect = [
            [mock_scenario],  # First call to .all() returns scenarios
            [
                MockChat(chat_id, scenario_id, datetime.now())
            ],  # Second call returns chats
            messages,  # Third call returns messages
        ]
        mock_db_session.exec.return_value = mock_exec_chain

        # Act
        result = agent_response_times(str(agent_id))

        # Assert
        assert "error" not in result
        assert result["stats"]["total_responses"] == 2
        assert result["stats"]["avg_response_time"] == 4.50
        assert result["stats"]["min_response_time"] == 4.00
        assert result["stats"]["max_response_time"] == 5.00
        assert result["agent"]["id"] == str(agent_id)
        mock_db_session.close.assert_called_once()  # Verify session was closed

    def test_agent_not_found(self, mock_get_session, mock_db_session):
        """Test case where the agent_id does not exist."""
        mock_get_session.return_value = iter([mock_db_session])
        mock_db_session.get.return_value = None  # Simulate agent not found

        non_existent_id = str(uuid.uuid4())
        result = agent_response_times(non_existent_id)

        assert result == {"error": f"Agent not found: {non_existent_id}"}
        mock_db_session.close.assert_called_once()

    def test_database_error(self, mock_get_session, mock_db_session):
        """Test handling of a SQLAlchemyError."""
        mock_get_session.return_value = iter([mock_db_session])
        mock_db_session.get.side_effect = SQLAlchemyError("Connection failed")

        result = agent_response_times(str(uuid.uuid4()))

        assert "error" in result
        assert "Database error" in result["error"]
        mock_db_session.close.assert_called_once()


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `agent_response_times`")
class TestAgent_Response_Times:
    """Tests for agent_response_times function."""

    def test_agent_response_times_success(self):
        """Test successful agent_response_times execution."""
        # TODO: Implement test for agent_response_times
        assert False, "IMPLEMENT: Test for agent_response_times"

    def test_agent_response_times_error(self):
        """Test agent_response_times error handling."""
        # TODO: Implement error test for agent_response_times
        assert False, "IMPLEMENT: Error test for agent_response_times"
