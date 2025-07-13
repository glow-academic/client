"""
Pytest configuration and shared fixtures.
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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.types import ARRAY
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool


# 4. The rest of your fixtures and configurations remain the same
class FakeRunnerStream:
    """
    Mimics the object returned by Runner.run_streamed().
    Yields a single raw_response_event with the provided text.
    """

    def __init__(self, text: str = "hello world"):
        self.text = text

    async def stream_events(self):
        yield types.SimpleNamespace(
            type="raw_response_event", data=ResponseTextDeltaEvent(delta=self.text)
        )


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    """Tells SQLAlchemy to treat JSONB as JSON in SQLite."""
    return "JSON"


@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    """Tells SQLAlchemy to treat ARRAY as JSON in SQLite."""
    return "JSON"


@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine once per session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(scope="session")
def client(test_engine):
    """
    Create a single TestClient instance for the whole session.
    This starts the app only once.
    """
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def test_session(test_engine, client):
    """
    Create a new database session for each test.
    This fixture injects the session into the app and handles cleanup.
    """
    # Create a new session for a single test
    with Session(test_engine) as session:
        # Override the app's dependency with this new session
        app.dependency_overrides[get_session] = lambda: session

        # Yield the session to the test function
        yield session

    # After the test is done, clear the override
    app.dependency_overrides.clear()


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


@pytest.fixture
def sample_uuid():
    """Generate a sample UUID for testing."""
    from uuid import uuid4

    return str(uuid4())


@pytest.fixture(autouse=True)
def patch_runner(mocker):
    """Replace Runner.run_streamed with a MagicMock."""
    fake_stream = FakeRunnerStream("mock-reply")
    mock = mocker.patch.object(Runner, "run_streamed", return_value=fake_stream)
    return mock


def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")


pytest_plugins = ("pytest_asyncio",)
