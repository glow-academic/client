"""
Pytest configuration and shared fixtures (Simplified for Mock-based Testing).
"""
# 1. Standard library imports and path setup FIRST
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

# 2. Add the server directory to Python's path so it can find the 'app' module
server_dir = Path(__file__).parent.parent
sys.path.insert(0, str(server_dir))

# 3. NOW, import from your application and third-party libraries
import pytest
from agents import Runner
from app.db import get_session
# Import the correct FastAPI instance directly from your main application file
from app.main import fastapi_app as app
from fastapi.testclient import TestClient
from openai.types.responses import ResponseTextDeltaEvent
from sqlmodel import Session


# --- HIGH-LEVEL MOCKS ---

class FakeRunnerStream:
    """Mimics the object returned by Runner.run_streamed()."""
    def __init__(self, text: str = "hello world"):
        self.text = text

    async def stream_events(self):
        yield types.SimpleNamespace(
            type="raw_response_event", data=ResponseTextDeltaEvent(delta=self.text)
        )

@pytest.fixture(autouse=True)
def patch_runner(mocker):
    """Replace Runner.run_streamed with a MagicMock for all tests."""
    fake_stream = FakeRunnerStream("mock-reply")
    mock = mocker.patch.object(Runner, "run_streamed", return_value=fake_stream)
    return mock

# --- CORE TEST FIXTURES ---

@pytest.fixture(scope="session")
def client():
    """Create a single TestClient instance for the whole session."""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def mock_session():
    """
    Creates a MagicMock for the database session and injects it into the app.
    This is the primary fixture for database mocking.
    """
    session = MagicMock(spec=Session)
    app.dependency_overrides[get_session] = lambda: session
    
    yield session
    
    # Clean up the override after the test is done
    app.dependency_overrides.clear()

# --- OTHER CONFIG ---

def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")


pytest_plugins = ("pytest_asyncio",)