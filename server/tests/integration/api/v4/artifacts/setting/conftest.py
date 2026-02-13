"""Shared fixtures for setting artifact integration tests.

Setting artifact endpoints use get_pool() internally for parallel resource
fetching and profile context resolution. This requires:
1. Session-scoped event loop (to match the pool's event loop)
2. JIT-compiled SQL types/functions/views COMMITTED to DB (visible to all
   pool connections, not just the test transaction)

The bootstrap fixture applies SQL files in dependency order using a separate
committed connection. Test isolation is limited for mutations since changes
via pool connections are committed.
"""

from collections.abc import AsyncGenerator
from pathlib import Path

import asyncpg  # type: ignore
import httpx
import pytest_asyncio

from app.main import fastapi_app, get_db, get_pool

# All SQL files needed, in dependency order.
# GET files define composite types -> SEARCH files reference those types.
_SETTING_SQL_FILES = [
    # Phase 1: Legacy views (foundation for profile context + drafts)
    "app/sql/v4/views/legacy/create_legacy_entry_views_complete.sql",
    # Phase 2: Resource GET files (create composite types)
    "app/sql/v4/queries/resources/names/get_names_complete.sql",
    "app/sql/v4/queries/resources/descriptions/get_descriptions_complete.sql",
    "app/sql/v4/queries/resources/agents/get_agents_complete.sql",
    "app/sql/v4/queries/resources/models/get_models_complete.sql",
    "app/sql/v4/queries/resources/departments/get_departments_complete.sql",
    "app/sql/v4/queries/resources/providers/get_providers_complete.sql",
    "app/sql/v4/queries/resources/flags/get_flags_complete.sql",
    "app/sql/v4/queries/resources/tools/get_tools_complete.sql",
    "app/sql/v4/queries/resources/profiles/get_profiles_complete.sql",
    "app/sql/v4/queries/resources/prompts/get_prompts_complete.sql",
    "app/sql/v4/queries/resources/instructions/get_instructions_complete.sql",
    "app/sql/v4/queries/resources/keys/get_keys_complete.sql",
    # Setting-specific resource GET files
    "app/sql/v4/queries/resources/colors/get_colors_complete.sql",
    "app/sql/v4/queries/resources/auths/get_auths_complete.sql",
    "app/sql/v4/queries/resources/auth_item_keys/get_auth_item_keys_complete.sql",
    "app/sql/v4/queries/resources/provider_keys/get_provider_keys_complete.sql",
    "app/sql/v4/queries/resources/roles/get_roles_complete.sql",
    "app/sql/v4/queries/resources/role_routes/get_role_routes_complete.sql",
    # Phase 3: Resource SEARCH files (reference composite types from GET)
    "app/sql/v4/queries/resources/names/search_names_complete.sql",
    "app/sql/v4/queries/resources/descriptions/search_descriptions_complete.sql",
    "app/sql/v4/queries/resources/agents/search_agents_complete.sql",
    "app/sql/v4/queries/resources/models/search_models_complete.sql",
    "app/sql/v4/queries/resources/departments/search_departments_complete.sql",
    "app/sql/v4/queries/resources/providers/search_providers_complete.sql",
    "app/sql/v4/queries/resources/flags/search_flags_complete.sql",
    "app/sql/v4/queries/resources/tools/search_tools_complete.sql",
    "app/sql/v4/queries/resources/profiles/search_profiles_complete.sql",
    "app/sql/v4/queries/resources/prompts/search_prompts_complete.sql",
    "app/sql/v4/queries/resources/instructions/search_instructions_complete.sql",
    "app/sql/v4/queries/resources/keys/search_keys_complete.sql",
    # Setting-specific resource SEARCH files
    "app/sql/v4/queries/resources/colors/search_colors_complete.sql",
    "app/sql/v4/queries/resources/auths/search_auths_complete.sql",
    "app/sql/v4/queries/resources/auth_item_keys/search_auth_item_keys_complete.sql",
    "app/sql/v4/queries/resources/provider_keys/search_provider_keys_complete.sql",
    "app/sql/v4/queries/resources/roles/search_roles_complete.sql",
    "app/sql/v4/queries/resources/role_routes/search_role_routes_complete.sql",
    # Phase 4: Profile context (depends on legacy views)
    "app/sql/v4/queries/profile/get_profile_context_access_complete.sql",
    "app/sql/v4/queries/profile/get_profile_context_complete.sql",
    # Phase 5: Draft views (depends on legacy views)
    "app/sql/v4/queries/views/drafts/get_draft_setting_view_complete.sql",
    # Phase 6: Setting artifact SQL files
    "app/sql/v4/queries/settings/get_setting_access_complete.sql",
    "app/sql/v4/queries/settings/get_setting_ids_complete.sql",
    "app/sql/v4/queries/settings/get_settings_list_complete.sql",
    "app/sql/v4/queries/settings/save_setting_complete.sql",
    "app/sql/v4/queries/settings/patch_setting_draft_complete.sql",
    "app/sql/v4/queries/settings/delete_setting_complete.sql",
    "app/sql/v4/queries/settings/duplicate_setting_complete.sql",
    "app/sql/v4/queries/settings/check_setting_save_access_complete.sql",
    "app/sql/v4/queries/settings/check_setting_delete_access_complete.sql",
    "app/sql/v4/queries/settings/check_setting_duplicate_access_complete.sql",
    "app/sql/v4/queries/settings/get_settings_theme_data_complete.sql",
    "app/sql/v4/queries/settings/get_active_settings_complete.sql",
]


@pytest_asyncio.fixture(loop_scope="session", scope="session", autouse=True)
async def bootstrap_setting_sql() -> None:
    """Bootstrap SQL types, views, and functions COMMITTED to the database.

    Uses a separate connection that auto-commits so that all pool connections
    (including those acquired by artifact endpoints) can see the types/views.
    Must run before db/client fixtures.
    """
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool not available. Did initialize_test_db run?")

    server_dir = Path(__file__).parent.parent.parent.parent.parent.parent
    async with pool.acquire() as conn:
        for sql_path in _SETTING_SQL_FILES:
            full_path = server_dir / sql_path
            if full_path.exists():
                sql_text = full_path.read_text()
                try:
                    await conn.execute(sql_text)
                except asyncpg.exceptions.PostgresError:
                    pass


@pytest_asyncio.fixture(loop_scope="session", scope="session")
async def db(bootstrap_setting_sql: None) -> AsyncGenerator[asyncpg.Connection, None]:
    """Session-scoped database connection using the test pool.

    Uses the pool directly (same event loop) to avoid event loop mismatch
    with get_pool() calls inside artifact endpoints.

    NOTE: Session-scoped means mutations are NOT rolled back between tests.
    Tests should be written to tolerate this.
    """
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool not available. Did initialize_test_db run?")

    conn = await pool.acquire()
    try:
        yield conn
    finally:
        await pool.release(conn)


@pytest_asyncio.fixture(loop_scope="session", scope="session")
async def client(
    db: asyncpg.Connection,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Session-scoped HTTP test client with database dependency override."""

    async def override_get_db() -> AsyncGenerator[asyncpg.Connection, None]:
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db

    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as test_client:
        yield test_client

    fastapi_app.dependency_overrides.clear()
