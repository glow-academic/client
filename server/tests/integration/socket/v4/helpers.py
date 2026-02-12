"""Helper functions for socket v4 integration tests."""

import asyncpg  # type: ignore

from app.sql.types import (
    GetOrCreateTestProfileV4SqlParams,
)
from app.utils.sql_helper import execute_sql_typed


async def get_or_create_test_profile(
    db: asyncpg.Connection, email: str = "redacted@purdue.edu"
) -> str:
    """Get existing profile by email or create a new one."""
    params = GetOrCreateTestProfileV4SqlParams(email=email)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/helpers/test_get_or_create_test_profile_v4_complete.sql",
        params=params,
    )
    return str(result.profile_id)
