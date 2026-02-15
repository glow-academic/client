"""
Pytest configuration and shared fixtures for real database testing.
"""

import os
import sys
from collections.abc import AsyncGenerator
from pathlib import Path
from urllib.parse import urlparse, urlunparse

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
# Enable container reuse by default for fast local runs
os.environ["TESTCONTAINERS_REUSE_ENABLE"] = os.getenv(
    "TESTCONTAINERS_REUSE_ENABLE", "true"
)
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
from app.utils.test_db import get_test_db_url  # noqa: E402

# Store the test database URL for direct connections
_test_db_url: str | None = None


def _filter_meta_commands(sql: str) -> str:
    """Strip psql meta-commands (lines starting with \\) from SQL."""
    return "\n".join(
        line for line in sql.split("\n") if not line.strip().startswith("\\")
    )


# --- CORE TEST FIXTURES ---


@pytest_asyncio.fixture(scope="session", autouse=True)
async def initialize_test_db() -> AsyncGenerator[None, None]:
    """Spin up disposable Postgres via init_db_pool and tear it down.

    Uses a template database to skip schema + seed + bootstrap on warm runs.
    The template is invalidated automatically when any SQL file changes.
    """
    global _test_db_url

    database_dir = Path(__file__).parent.parent.parent / "database"
    sql_dir = server_dir / "app" / "sql"
    schema_file = database_dir / "schema.sql"
    seed_file = database_dir / "test-seed.sql"

    if not schema_file.exists():
        raise FileNotFoundError(
            f"Schema file not found: {schema_file}\n"
            "Please run 'make export-schema' to generate it."
        )

    if not seed_file.exists():
        raise FileNotFoundError(
            f"Test seed file not found: {seed_file}\n"
            "Please run 'make build-test-seed' to generate it."
        )

    # 1. Start / reuse the test container and create a pool to the default DB
    await init_db_pool()

    base_url = get_test_db_url()
    if base_url is None:
        raise RuntimeError("Test database URL not available")

    from app.utils.template_db import (
        cleanup_old_templates,
        clone_from_template,
        compute_db_hash,
        create_fresh_db,
        get_admin_url,
        save_as_template,
        template_exists,
    )

    # 2. Compute content hash
    db_hash = compute_db_hash(database_dir, sql_dir)
    template_name = f"template_glow_{db_hash}"
    clone_name = f"test_glow_{db_hash}"
    admin_url = get_admin_url(base_url)

    print(f"🔑 Template hash: {db_hash}")

    # 3. Connect to admin DB and check for template
    import app.main as main_mod

    admin_conn = await asyncpg.connect(admin_url)
    try:
        has_template = await template_exists(admin_conn, template_name)

        if has_template:
            # --- WARM PATH: clone from template ---
            print(f"⚡ Template found: {template_name} — cloning to {clone_name}")
            await clone_from_template(admin_conn, template_name, clone_name)

            # Reconnect pool to the cloned database
            parsed = urlparse(base_url)
            clone_url = urlunparse(parsed._replace(path=f"/{clone_name}"))

            if main_mod._db_pool:
                await main_mod._db_pool.close()
            main_mod._db_pool = await asyncpg.create_pool(
                clone_url, min_size=1, max_size=5
            )
            main_mod._test_db_url = clone_url
            _test_db_url = clone_url
            print("✅ Cloned database ready (schema + seed + SQL skipped)")
        else:
            # --- COLD PATH: build from scratch, then save as template ---
            print("🏗️  No template found — building from scratch")

            # Create a fresh database to avoid conflicts with stale state
            build_db = f"build_glow_{db_hash}"
            await create_fresh_db(admin_conn, build_db)

            # Reconnect pool to the fresh build database
            parsed = urlparse(base_url)
            build_url = urlunparse(parsed._replace(path=f"/{build_db}"))

            if main_mod._db_pool:
                await main_mod._db_pool.close()
            main_mod._db_pool = await asyncpg.create_pool(
                build_url, min_size=1, max_size=5
            )

            pool = main_mod._db_pool

            schema_sql = _filter_meta_commands(schema_file.read_text())
            async with pool.acquire() as conn:
                await conn.execute(schema_sql)
            print("🗄️  Test schema applied")

            # Apply seed data
            seed_sql = _filter_meta_commands(seed_file.read_text())
            async with pool.acquire() as conn:
                await conn.execute(seed_sql)
            print("🗄️  Test seed data applied")

            # Bootstrap SQL views + functions
            from tests.bootstrap_sql import bootstrap_all_sql

            async with pool.acquire() as conn:
                await bootstrap_all_sql(conn)
            print("🗄️  SQL views and functions bootstrapped")

            # Close pool before saving template (terminates connections)
            await main_mod._db_pool.close()
            main_mod._db_pool = None

            # Save as template for next run
            await save_as_template(admin_conn, build_db, template_name)
            print(f"💾 Template saved: {template_name}")

            # Clean up old templates (this drops build_glow_* too)
            await cleanup_old_templates(admin_conn)

            # Clone from the freshly saved template for the test run
            await clone_from_template(admin_conn, template_name, clone_name)
            clone_url = urlunparse(parsed._replace(path=f"/{clone_name}"))

            main_mod._db_pool = await asyncpg.create_pool(
                clone_url, min_size=1, max_size=5
            )
            main_mod._test_db_url = clone_url
            _test_db_url = clone_url
    finally:
        await admin_conn.close()

    # Fallback: if _test_db_url wasn't set above
    if _test_db_url is None:
        _test_db_url = base_url

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
