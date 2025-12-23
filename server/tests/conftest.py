"""
Pytest configuration and shared fixtures for real database testing.
"""

import os
import sys
from collections.abc import AsyncGenerator
from pathlib import Path

import asyncpg  # type: ignore[import]
import pytest
import pytest_asyncio
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# Disable tracing globally BEFORE importing agents
os.environ["OPENAI_AGENTS_DISABLE_TRACING"] = "1"
# Set SECRET_KEY for encryption/decryption in tests
# This will use SECRET_KEY from .env if available, otherwise use default
os.environ["SECRET_KEY"] = os.getenv(
    "SECRET_KEY", "test_secret_key_for_integration_tests"
)
# Ensure Testcontainers-backed DB is used
os.environ["ENV"] = os.getenv("ENV", "TEST")
# Ensure header signing works in test environment
os.environ["AUTH_SECRET"] = os.getenv(
    "AUTH_SECRET", "test_secret_key_for_integration_tests"
)
os.environ["E2E_PROFILE_ID"] = os.getenv(
    "E2E_PROFILE_ID", "965bd24f-dfae-4063-b370-e1373df46322"
)
os.environ["E2E_STORAGE"] = os.getenv("E2E_STORAGE", "")

# Add the server directory to Python's path
server_dir = Path(__file__).parent.parent
sys.path.insert(0, str(server_dir))

from app.main import close_db_pool, init_db_pool  # noqa: E402
from utils.test_db import get_test_db_url  # noqa: E402

# Store the test database URL for direct connections
_test_db_url: str | None = None


# --- CORE TEST FIXTURES ---


@pytest_asyncio.fixture(scope="session", autouse=True)
async def initialize_test_db() -> AsyncGenerator[None, None]:
    """Spin up disposable Postgres via init_db_pool and tear it down.

    This initializes the test container and applies the schema.
    Individual tests create their own connections to avoid event loop issues.
    """
    global _test_db_url

    schema_file = Path(__file__).parent.parent.parent / "database" / "schema.sql"

    if not schema_file.exists():
        raise FileNotFoundError(
            f"Schema file not found: {schema_file}\n"
            "Please run 'make export-db schema' to generate it."
        )

    await init_db_pool()

    # Get the connection URL from the test container for direct connections
    # This avoids event loop issues with the pool
    _test_db_url = get_test_db_url()
    if _test_db_url is None:
        raise RuntimeError("Test database URL not available")

    try:
        yield
    finally:
        await close_db_pool()
        _test_db_url = None


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Provide clean database connection with transaction rollback.

    Each test gets:
    - Connection to database with schema already applied (session level)
    - Transaction that rolls back after test completes (test isolation)

    Creates connections directly instead of using the pool to avoid event loop issues.
    """
    global _test_db_url

    if _test_db_url is None:
        raise RuntimeError(
            "Test database URL not available. Did initialize_test_db run?"
        )

    # Create connection directly (not from pool) to avoid event loop issues
    conn = await asyncpg.connect(_test_db_url)

    tx = conn.transaction()
    await tx.start()
    try:
        yield conn
    finally:
        await tx.rollback()  # Undo all test changes
        await conn.close()


@pytest.fixture
def disable_cache() -> None:
    """Disable caching in tests.

    This is a no-op fixture since the codebase uses manual caching
    (get_cached/set_cached) rather than a decorator. Tests include this
    fixture for consistency and in case caching behavior needs to be
    disabled in the future.
    """
    # No-op: caching is done manually via get_cached/set_cached,
    # not via a decorator, so there's nothing to disable
    pass


# --- OTHER CONFIG ---


def pytest_configure(config: pytest.Config) -> None:
    """Configure pytest markers."""
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")


pytest_plugins = ("pytest_asyncio",)
