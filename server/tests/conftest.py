"""
Pytest configuration and shared fixtures (Simplified for Mock-based Testing).
"""

import os
# 1. Standard library imports and path setup FIRST
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

# 2. Disable tracing globally BEFORE importing agents
os.environ["OPENAI_AGENTS_DISABLE_TRACING"] = "1"

# 3. Add the server directory to Python's path so it can find the 'app' module
server_dir = Path(__file__).parent.parent
sys.path.insert(0, str(server_dir))

# 4. NOW, import from your application and third-party libraries
import pytest  # noqa: E402
from agents import Runner  # noqa: E402
from app.db import get_session  # noqa: E402
# Import the correct FastAPI instance directly from your main application file
from app.main import fastapi_app as app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from openai.types.responses import ResponseTextDeltaEvent  # noqa: E402
from sqlmodel import Session  # noqa: E402

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
    """Replace Runner methods with MagicMocks for all tests."""
    # Disable tracing globally by setting environment variable
    import os

    os.environ["OPENAI_AGENTS_DISABLE_TRACING"] = "1"

    # Mock Runner.run_streamed
    fake_stream = FakeRunnerStream("mock-reply")
    mock_streamed = mocker.patch.object(
        Runner, "run_streamed", return_value=fake_stream
    )

    # Mock Runner.run
    mock_result = MagicMock()
    mock_result.final_output_as.return_value = MagicMock()
    mock_run = mocker.patch.object(Runner, "run", return_value=mock_result)

    # Mock the trace function to prevent real API calls
    mock_trace = mocker.patch("agents.trace")
    mock_trace.return_value.__enter__ = MagicMock()
    mock_trace.return_value.__exit__ = MagicMock()

    return mock_streamed, mock_run, mock_trace


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
