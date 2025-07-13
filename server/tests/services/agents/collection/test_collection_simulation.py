"""
Tests for app.services.agents.collection.simulation
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4
from app.services.agents.collection.simulation import *

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `run_simulation_agent`")
class TestRun_Simulation_Agent:
    """Tests for run_simulation_agent function."""

    def test_run_simulation_agent_success(self):
        """Test successful run_simulation_agent execution."""
        # TODO: Implement test for run_simulation_agent
        assert False, "IMPLEMENT: Test for run_simulation_agent"

    def test_run_simulation_agent_error(self):
        """Test run_simulation_agent error handling."""
        # TODO: Implement error test for run_simulation_agent
        assert False, "IMPLEMENT: Error test for run_simulation_agent"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `cancel_simulation_run`")
class TestCancel_Simulation_Run:
    """Tests for cancel_simulation_run function."""

    def test_cancel_simulation_run_success(self):
        """Test successful cancel_simulation_run execution."""
        # TODO: Implement test for cancel_simulation_run
        assert False, "IMPLEMENT: Test for cancel_simulation_run"

    def test_cancel_simulation_run_error(self):
        """Test cancel_simulation_run error handling."""
        # TODO: Implement error test for cancel_simulation_run
        assert False, "IMPLEMENT: Error test for cancel_simulation_run"

