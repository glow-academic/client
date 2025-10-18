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
from app.db import get_db  # noqa: E402
# Import the correct FastAPI instance directly from your main application file
from app.main import fastapi_app as app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from openai.types.responses import ResponseTextDeltaEvent  # noqa: E402

# --- CORE TEST FIXTURES ---


@pytest.fixture(scope="session")
def client():
    """Create a single TestClient instance for the whole session."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def mock_db_conn():
    """
    Creates a MagicMock for the database connection and injects it into the app.
    This is the primary fixture for database mocking with asyncpg.
    """
    async def mock_get_db():
        conn = MagicMock()
        conn.fetchrow = MagicMock()
        conn.fetch = MagicMock()
        conn.execute = MagicMock()
        yield conn
    
    app.dependency_overrides[get_db] = mock_get_db

    yield mock_get_db

    # Clean up the override after the test is done
    app.dependency_overrides.clear()


# --- OTHER CONFIG ---


def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")


pytest_plugins = ("pytest_asyncio",)
