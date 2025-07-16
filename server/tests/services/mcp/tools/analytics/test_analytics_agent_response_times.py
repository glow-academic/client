# test_agent_response_times.py

import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy.exc import SQLAlchemyError
from app.models import Agents, Scenarios, SimulationChats, SimulationMessages
from app.services.mcp.tools.analytics.agent_response_times import agent_response_times

AGENT_ID = uuid.uuid4()
SCENARIO_ID = uuid.uuid4()
CHAT_ID = uuid.uuid4()

@pytest.fixture(autouse=True)
def patch_db_session(mocker, test_session):
    """Ensure the function under test uses the test_session."""
    mocker.patch('app.services.mcp.tools.analytics.agent_response_times.get_session', return_value=iter([test_session]))

class TestAgentResponseTimes:
    """Tests for agent_response_times function."""

    def test_success_with_data(self, test_session):
        """Test successful execution with valid data."""
        # Arrange: Populate DB with mock data
        agent = Agents(id=AGENT_ID, name="Test Agent", description="An agent for testing.")
        scenario = Scenarios(id=SCENARIO_ID, agent_id=AGENT_ID, name="Test Scenario")
        chat = SimulationChats(id=CHAT_ID, scenario_id=SCENARIO_ID, created_at=datetime.now())
        
        time_now = datetime.now()
        msg1 = SimulationMessages(chat_id=CHAT_ID, type="query", content="Hello?", created_at=time_now - timedelta(seconds=15))
        msg2 = SimulationMessages(chat_id=CHAT_ID, type="response", content="Hi!", created_at=time_now - timedelta(seconds=5)) # 10s response time
        msg3 = SimulationMessages(chat_id=CHAT_ID, type="query", content="Again?", created_at=time_now - timedelta(seconds=4))
        msg4 = SimulationMessages(chat_id=CHAT_ID, type="response", content="Yes.", created_at=time_now) # 4s response time
        
        test_session.add_all([agent, scenario, chat, msg1, msg2, msg3, msg4])
        test_session.commit()

        # Act
        result = agent_response_times(str(AGENT_ID))

        # Assert
        assert "error" not in result
        assert result["agent"]["id"] == str(AGENT_ID)
        assert result["stats"]["total_responses"] == 2
        assert result["stats"]["avg_response_time"] == 7.00 # (10 + 4) / 2
        assert result["stats"]["min_response_time"] == 4.00
        assert result["stats"]["max_response_time"] == 10.00
        assert result["stats"]["median_response_time"] == 4.00 # sorted([4, 10]) -> 4
        assert len(result["recent_responses"]) == 2
        assert result["recent_responses"][0]["response_time_seconds"] == 10.00 # Sorted slowest first

    def test_agent_not_found(self, test_session):
        """Test case where the agent_id does not exist."""
        non_existent_id = str(uuid.uuid4())
        result = agent_response_times(non_existent_id)
        assert result == {"error": f"Agent not found: {non_existent_id}"}

    def test_invalid_uuid_format(self, test_session):
        """Test case with an invalid UUID format for agent_id."""
        invalid_id = "not-a-uuid"
        result = agent_response_times(invalid_id)
        assert result == {"error": f"Invalid agent_id format: {invalid_id}"}

    def test_agent_with_no_scenarios(self, test_session):
        """Test case where agent exists but has no associated scenarios."""
        agent = Agents(id=AGENT_ID, name="Lonely Agent")
        test_session.add(agent)
        test_session.commit()

        result = agent_response_times(str(AGENT_ID))
        assert "error" not in result
        assert result["stats"]["message"] == "No scenarios found for this agent"
        assert result["recent_responses"] == []

    def test_agent_with_no_response_data(self, test_session):
        """Test case where agent has scenarios but no recent chat data."""
        agent = Agents(id=AGENT_ID, name="Quiet Agent")
        scenario = Scenarios(id=SCENARIO_ID, agent_id=AGENT_ID, name="Empty Scenario")
        test_session.add_all([agent, scenario])
        test_session.commit()

        result = agent_response_times(str(AGENT_ID))
        assert "error" not in result
        assert "No response data found" in result["stats"]["message"]
        assert result["recent_responses"] == []

    def test_database_error(self, mocker):
        """Test handling of a SQLAlchemyError during database query."""
        # Arrange: Mock the session to raise an error
        mock_session = MagicMock()
        mock_session.get.side_effect = SQLAlchemyError("Connection failed")
        mocker.patch('app.services.mcp.tools.analytics.agent_response_times.get_session', return_value=iter([mock_session]))

        # Act
        result = agent_response_times(str(AGENT_ID))

        # Assert
        assert "error" in result
        assert "Database error" in result["error"]

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

