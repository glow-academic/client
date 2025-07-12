"""
Pytest configuration and shared fixtures.

Auto-generated on: 2025-06-08T17:10:03.505300
"""

# Import your app
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from agents import Runner
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.types import JSON, ARRAY
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

# Add the server directory to Python path
server_dir = Path(__file__).parent.parent
sys.path.insert(0, str(server_dir))

import types

from app.db import get_session
from app.main import app
from openai.types.responses import ResponseTextDeltaEvent


class FakeRunnerStream:
    """
    Mimics the object returned by Runner.run_streamed().
    Yields a single raw_response_event with the provided text.
    """
    def __init__(self, text: str = "hello world"):
        self.text = text

    async def stream_events(self):
        # The real SDK yields SimpleNamespace-ish objects
        yield types.SimpleNamespace(
            type="raw_response_event",
            data=ResponseTextDeltaEvent(delta=self.text)
        )

# Add this block to handle JSONB in SQLite
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    """
    Tells SQLAlchemy to treat JSONB columns as generic JSON
    when creating tables in a SQLite database.
    """
    return "JSON"

# Add this NEW block for the ARRAY type
@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    """
    Tells SQLAlchemy to treat ARRAY columns as JSON
    when creating tables in a SQLite database.
    """
    return "JSON"

@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def test_session(test_engine):
    """Create a test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def client(test_session):
    """Create a test client with database session override."""

    def get_test_session():
        return test_session

    app.dependency_overrides[get_session] = get_test_session

    with TestClient(app) as test_client:
        yield test_client

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


@pytest.fixture(autouse=True)  # applied to every test
def patch_runner(mocker):
    """
    Replace Runner.run_streamed with a MagicMock that returns
    an instance of FakeRunnerStream.
    """
    fake_stream = FakeRunnerStream("mock-reply")       # customise per test if you like
    mock = mocker.patch.object(
        Runner,
        "run_streamed",
        return_value=fake_stream
    )
    return mock  # let tests assert call args if they need



# Pytest configuration
def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")


# Configure pytest-asyncio
pytest_plugins = ("pytest_asyncio",)
