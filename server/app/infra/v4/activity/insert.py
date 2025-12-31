"""Insert activity record for HTTP requests."""

import asyncpg  # type: ignore
from typing import cast

from app.infra.v4.activity.profile_exists import profile_exists
from app.sql.types import (
    InfrastructureActivityInsertSqlParams,
    InfrastructureActivityInsertSqlRow,
)
from utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/infrastructure/infrastructure_activity_insert_complete.sql"


async def insert_activity(
    message: str,
    endpoint: str,
    profile_id: str | None,
    error: bool,
    conn: asyncpg.Connection,
) -> None:
    """Insert activity record into database.

    Args:
        message: Fully rendered activity message
        endpoint: Route path
        profile_id: Profile UUID string (can be None)
        error: Whether this activity represents an error
        conn: Database connection
    """
    # Check if profile exists, set profile_id to NULL if it doesn't
    # This prevents foreign key violations for test profiles that don't exist in production
    profile_id_uuid = None
    if profile_id:
        exists = await profile_exists(profile_id, conn)
        if exists:
            profile_id_uuid = profile_id
        # If profile doesn't exist, profile_id_uuid remains None (NULL in database)

    params = InfrastructureActivityInsertSqlParams(
        message=message,
        endpoint=endpoint,
        profile_id=profile_id_uuid,
        error=error,
    )
    cast(
        InfrastructureActivityInsertSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
