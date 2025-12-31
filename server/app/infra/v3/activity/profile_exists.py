"""Check if a profile exists in the database."""

import asyncpg  # type: ignore
from typing import cast

from app.sql.types import (
    InfraActivityProfileExistsSqlParams,
    InfraActivityProfileExistsSqlRow,
)
from utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v3/infrastructure/activity/profile_exists_complete.sql"


async def profile_exists(profile_id: str, conn: asyncpg.Connection) -> bool:
    """Check if a profile exists in the database.

    Args:
        profile_id: Profile UUID string
        conn: Database connection

    Returns:
        True if profile exists, False otherwise
    """
    try:
        params = InfraActivityProfileExistsSqlParams(profile_id=profile_id)
        result = cast(
            InfraActivityProfileExistsSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        return result.profile_exists if result else False
    except (asyncpg.DataError, ValueError):
        # Invalid UUID format - profile cannot exist
        return False
