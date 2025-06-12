"""
Tests for app.routes.simulations

Auto-generated on: 2025-06-09T22:54:04.062044
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4, UUID
import json

# Import the router being tested
from app.routes.simulations import router
from app.db import get_session
from app.models import (
    Simulations,
    SimulationAttempts,
    SimulationChats,
    Scenarios,
    Agents,
    Classes,
    Users
)

@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from app.main import app
    return TestClient(app)

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)

@pytest.fixture
def sample_simulation():
    """Create a sample simulation for testing."""
    return Simulations(
        id=uuid4(),
        title="Test Simulation",
        scenario_ids=[uuid4(), uuid4()],
        active=True,
        class_id=uuid4(),
        time_limit=30,
        rubric_id=uuid4()
    )

@pytest.fixture
def sample_scenario():
    """Create a sample scenario for testing."""
    return Scenarios(
        id=uuid4(),
        name="Test Scenario",
        description="A test scenario",
        agent_id=uuid4(),
        crowdedness=3,
        intensity=2,
        seniority="sophomore"
    )

@pytest.fixture
def sample_agent():
    """Create a sample agent for testing."""
    return Agents(
        id=uuid4(),
        name="Test Agent",
        subtitle="Test Subtitle",
        description="Test Description",
        system_prompt="Test prompt",
        agent_type="student",
        temperature=7
    )

@pytest.fixture
def sample_user():
    """Create a sample user for testing."""
    return Users(
        id=uuid4(),
        name="Test User",
        username="testuser",
        password="password",
        role="ta",
        class_ids=[]
    )

@pytest.fixture
def sample_class():
    """Create a sample class for testing."""
    return Classes(
        id=uuid4(),
        name="Test Class",
        class_code="CS101",
        year=2024,
        term="fall",
        description="Test class"
    )


class TestStartAttempt:
    """Tests for start_attempt endpoint."""
    
    def test_start_attempt_success_with_user(self, sample_simulation, sample_scenario, sample_agent, sample_user, sample_class):
        """Test successful start_attempt request with authenticated user."""
        # Setup mocks
        mock_session = MagicMock()
        
        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=sample_simulation)),  # simulation query
            MagicMock(one_or_none=MagicMock(return_value=sample_scenario)),    # scenario query
            MagicMock(one_or_none=MagicMock(return_value=sample_agent))        # agent query
        ]
        
        # Mock the attempt and chat creation
        mock_attempt = MagicMock()
        mock_attempt.id = uuid4()
        mock_chat = MagicMock()
        mock_chat.id = uuid4()
        
        mock_session.refresh.side_effect = [mock_attempt, mock_chat]
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/start",
                data={
                    "simulation_id": str(sample_simulation.id),
                    "profile_id": str(sample_user.id),
                    "class_id": str(sample_class.id),
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "attempt_id" in data
            assert "chat_id" in data
            assert data["message"] == "Attempt started successfully"
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_start_attempt_success_guest_mode(self, sample_simulation, sample_scenario, sample_agent, sample_class):
        """Test successful start_attempt request in guest mode (no profile_id)."""
        # Setup mocks
        mock_session = MagicMock()
        
        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=sample_simulation)),  # simulation query
            MagicMock(one_or_none=MagicMock(return_value=sample_scenario)),    # scenario query
            MagicMock(one_or_none=MagicMock(return_value=sample_agent))        # agent query
        ]
        
        # Mock the attempt and chat creation
        mock_attempt = MagicMock()
        mock_attempt.id = uuid4()
        mock_chat = MagicMock()
        mock_chat.id = uuid4()
        
        mock_session.refresh.side_effect = [mock_attempt, mock_chat]
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/start",
                data={
                    "simulation_id": str(sample_simulation.id),
                    "class_id": str(sample_class.id),
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "attempt_id" in data
            assert "chat_id" in data
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_start_attempt_empty_string_profile_id(self, sample_simulation, sample_scenario, sample_agent, sample_class):
        """Test start_attempt with empty string profile_id (should be treated as guest mode)."""
        # Setup mocks
        mock_session = MagicMock()
        
        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=sample_simulation)),
            MagicMock(one_or_none=MagicMock(return_value=sample_scenario)),
            MagicMock(one_or_none=MagicMock(return_value=sample_agent))
        ]
        
        mock_attempt = MagicMock()
        mock_attempt.id = uuid4()
        mock_chat = MagicMock()
        mock_chat.id = uuid4()
        
        mock_session.refresh.side_effect = [mock_attempt, mock_chat]
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/start",
                data={
                    "simulation_id": str(sample_simulation.id),
                    "profile_id": "",  # Empty string should be treated as None
                    "class_id": str(sample_class.id)
                }
            )
            
            assert response.status_code == 200
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_start_attempt_simulation_not_found(self):
        """Test start_attempt when simulation doesn't exist."""
        mock_session = MagicMock()
        
        # Mock simulation not found
        mock_session.exec.return_value.one_or_none.return_value = None
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/start",
                data={
                    "simulation_id": str(uuid4()),
                    "class_id": str(uuid4())
                }
            )
            
            assert response.status_code == 404
            assert "Simulation not found" in response.json()["detail"]
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_start_attempt_no_scenarios(self, sample_simulation):
        """Test start_attempt when simulation has no scenarios."""
        mock_session = MagicMock()
        
        # Create simulation with no scenarios
        sample_simulation.scenario_ids = []
        mock_session.exec.return_value.one_or_none.return_value = sample_simulation
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/start",
                data={
                    "simulation_id": str(sample_simulation.id),
                    "class_id": str(uuid4())
                }
            )
            
            assert response.status_code == 400
            assert "no valid scenarios configured" in response.json()["detail"]
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_start_attempt_scenario_not_found(self, sample_simulation):
        """Test start_attempt when scenario doesn't exist."""
        mock_session = MagicMock()
        
        # Mock simulation found but scenario not found
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=sample_simulation)),  # simulation found
            MagicMock(one_or_none=MagicMock(return_value=None))                # scenario not found
        ]
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/start",
                data={
                    "simulation_id": str(sample_simulation.id),
                    "class_id": str(uuid4()),
                    
                }
            )
            
            assert response.status_code == 400
            assert "not found" in response.json()["detail"]
        finally:
            # Clean up
            app.dependency_overrides.clear()


class TestMessage:
    """Tests for message endpoint."""
    
    @patch('app.routes.simulations.run_generic_agent')
    def test_message_success(self, mock_run_generic_agent):
        """Test successful message request."""
        # Setup mocks
        mock_session = MagicMock()
        
        # Mock chat found and not completed
        mock_chat = MagicMock()
        mock_chat.completed = False
        mock_session.exec.return_value.one_or_none.return_value = mock_chat
        
        # Mock the async generator
        async def mock_token_generator():
            yield "Hello"
            yield " "
            yield "World"
        
        mock_run_generic_agent.return_value = mock_token_generator()
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/message",
                data={
                    "chat_id": str(uuid4()),
                    "message": "Test message",
                    
                }
            )
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_message_chat_not_found(self):
        """Test message when chat doesn't exist."""
        mock_session = MagicMock()
        
        # Mock chat not found
        mock_session.exec.return_value.one_or_none.return_value = None
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/message",
                data={
                    "chat_id": str(uuid4()),
                    "message": "Test message",
                    
                }
            )
            
            assert response.status_code == 404
            assert "Chat not found" in response.json()["detail"]
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_message_chat_completed(self):
        """Test message when chat is already completed."""
        mock_session = MagicMock()
        
        # Mock chat found but completed
        mock_chat = MagicMock()
        mock_chat.completed = True
        mock_session.exec.return_value.one_or_none.return_value = mock_chat
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/message",
                data={
                    "chat_id": str(uuid4()),
                    "message": "Test message",
                    
                }
            )
            
            assert response.status_code == 400
            assert "Cannot send messages to completed chat" in response.json()["detail"]
        finally:
            # Clean up
            app.dependency_overrides.clear()


class TestContinueAttempt:
    """Tests for continue_attempt endpoint."""
    
    @patch('app.routes.simulations.run_grade_agent')
    def test_continue_attempt_success_with_next_scenario(self, mock_run_grade_agent, sample_simulation, sample_scenario, sample_agent):
        """Test successful continue_attempt with next scenario available."""
        # Setup mocks
        mock_session = MagicMock()
        
        # Create scenario IDs for simulation
        scenario_id_1 = uuid4()
        scenario_id_2 = uuid4()
        sample_simulation.scenario_ids = [scenario_id_1, scenario_id_2]
        
        # Mock chat with first scenario
        mock_chat = MagicMock()
        mock_chat.scenario_id = scenario_id_1
        
        # Mock attempt
        mock_attempt = MagicMock()
        mock_attempt.simulation_id = sample_simulation.id
        
        # Mock next scenario
        next_scenario = MagicMock()
        next_scenario.id = scenario_id_2
        next_scenario.agent_id = sample_agent.id
        
        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=mock_chat)),        # chat query
            MagicMock(one_or_none=MagicMock(return_value=mock_attempt)),     # attempt query
            MagicMock(one_or_none=MagicMock(return_value=sample_simulation)), # simulation query
            MagicMock(one_or_none=MagicMock(return_value=next_scenario)),    # next scenario query
            MagicMock(one_or_none=MagicMock(return_value=sample_agent))      # agent query
        ]
        
        # Mock new chat creation
        mock_new_chat = MagicMock()
        mock_new_chat.id = uuid4()
        mock_session.refresh.return_value = mock_new_chat
        
        # Mock grade agent
        mock_run_grade_agent.return_value = str(uuid4())
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/continue",
                data={
                    "attempt_id": str(uuid4()),
                    "chat_id": str(uuid4()),
                    
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "chat_id" in data
            assert "rubric_id" in data
            assert data["completed"] is False
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    @patch('app.routes.simulations.run_grade_agent')
    def test_continue_attempt_success_no_more_scenarios(self, mock_run_grade_agent, sample_simulation):
        """Test successful continue_attempt when no more scenarios available."""
        # Setup mocks
        mock_session = MagicMock()
        
        # Create scenario with only one scenario
        scenario_id_1 = uuid4()
        sample_simulation.scenario_ids = [scenario_id_1]
        
        # Mock chat with the only scenario
        mock_chat = MagicMock()
        mock_chat.scenario_id = scenario_id_1
        chat_id = uuid4()
        mock_chat.id = chat_id
        
        # Mock attempt
        mock_attempt = MagicMock()
        mock_attempt.simulation_id = sample_simulation.id
        
        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=mock_chat)),        # chat query
            MagicMock(one_or_none=MagicMock(return_value=mock_attempt)),     # attempt query
            MagicMock(one_or_none=MagicMock(return_value=sample_simulation)) # simulation query
        ]
        
        # Mock grade agent
        mock_run_grade_agent.return_value = str(uuid4())
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/continue",
                data={
                    "attempt_id": str(uuid4()),
                    "chat_id": str(chat_id),
                    
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["completed"] is True  # Should be completed since no more scenarios
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_continue_attempt_chat_not_found(self):
        """Test continue_attempt when chat doesn't exist."""
        mock_session = MagicMock()
        
        # Mock chat not found
        mock_session.exec.return_value.one_or_none.return_value = None
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/continue",
                data={
                    "attempt_id": str(uuid4()),
                    "chat_id": str(uuid4()),
                    
                }
            )
            
            assert response.status_code == 404
            assert "Chat not found" in response.json()["detail"]
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_continue_attempt_attempt_not_found(self):
        """Test continue_attempt when attempt doesn't exist."""
        mock_session = MagicMock()
        
        # Mock chat found but attempt not found
        mock_chat = MagicMock()
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=mock_chat)),  # chat found
            MagicMock(one_or_none=MagicMock(return_value=None))        # attempt not found
        ]
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/continue",
                data={
                    "attempt_id": str(uuid4()),
                    "chat_id": str(uuid4()),
                    
                }
            )
            
            assert response.status_code == 404
            assert "Attempt not found" in response.json()["detail"]
        finally:
            # Clean up
            app.dependency_overrides.clear()
    
    def test_continue_attempt_simulation_not_found(self):
        """Test continue_attempt when simulation doesn't exist."""
        mock_session = MagicMock()
        
        # Mock chat and attempt found but simulation not found
        mock_chat = MagicMock()
        mock_attempt = MagicMock()
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=MagicMock(return_value=mock_chat)),     # chat found
            MagicMock(one_or_none=MagicMock(return_value=mock_attempt)),  # attempt found
            MagicMock(one_or_none=MagicMock(return_value=None))           # simulation not found
        ]
        
        from app.main import app
        
        # Override the dependency
        def override_get_session():
            return mock_session
        
        app.dependency_overrides[get_session] = override_get_session
        
        try:
            client = TestClient(app)
            
            response = client.post(
                "/simulations/continue",
                data={
                    "attempt_id": str(uuid4()),
                    "chat_id": str(uuid4()),
                    
                }
            )
            
            assert response.status_code == 404
            assert "Simulation not found" in response.json()["detail"]
        finally:
            # Clean up
            app.dependency_overrides.clear()

