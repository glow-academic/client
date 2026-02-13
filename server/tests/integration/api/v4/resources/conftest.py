"""Shared fixtures for resource integration tests.

Resource SQL files use JIT-created composite types and functions.
The GET SQL file for each resource creates the types that SEARCH references.
This fixture bootstraps all needed types/functions before tests run.
"""

from pathlib import Path

import asyncpg
import pytest_asyncio

# GET SQL files define composite types that SEARCH files reference.
# Order matters: GET must run before SEARCH for each resource.
_RESOURCE_SQL_FILES = [
    # GET files (create types + get functions)
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
    # SEARCH files (reference types from GET)
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
    # CREATE files (standalone functions)
    "app/sql/v4/queries/resources/names_complete.sql",
    "app/sql/v4/queries/resources/descriptions_complete.sql",
    "app/sql/v4/queries/resources/prompts_complete.sql",
    "app/sql/v4/queries/resources/instructions_complete.sql",
    "app/sql/v4/queries/resources/keys_complete.sql",
    # DECRYPT (keys only)
    "app/sql/v4/queries/keys/get_key_for_decrypt_complete.sql",
]


@pytest_asyncio.fixture(autouse=True)
async def bootstrap_resource_sql(db: asyncpg.Connection) -> None:
    """Bootstrap resource SQL types and functions before each test.

    Runs GET SQL files (which CREATE TYPE + CREATE FUNCTION) before
    SEARCH SQL files (which reference those types). Uses savepoints
    so that individual file failures don't abort the transaction.
    """
    server_dir = Path(__file__).parent.parent.parent.parent.parent.parent
    for sql_path in _RESOURCE_SQL_FILES:
        full_path = server_dir / sql_path
        if full_path.exists():
            sql_text = full_path.read_text()
            # Use savepoint so failures don't abort the outer transaction
            try:
                async with db.transaction():
                    await db.execute(sql_text)
            except asyncpg.exceptions.PostgresError:
                pass
