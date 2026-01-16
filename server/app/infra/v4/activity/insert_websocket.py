"""Insert activity record for WebSocket events."""

from typing import cast

import asyncpg  # type: ignore
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.profile_exists import profile_exists
from app.sql.types import (
    InfrastructureActivityInsertWebsocketSqlParams,
    InfrastructureActivityInsertWebsocketSqlRow,
)

SQL_PATH = (
    "app/sql/v4/infrastructure/infrastructure_activity_insert_websocket_complete.sql"
)


async def insert_activity_websocket(
    message: str,
    endpoint: str,
    profile_id: str | None,
    error: bool,
    conn: asyncpg.Connection,
) -> None:
    """Insert activity record into database for WebSocket events.

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

    params = InfrastructureActivityInsertWebsocketSqlParams(
        message=message,
        endpoint=endpoint,
        profile_id=profile_id_uuid,
        error=error,
    )
    cast(
        InfrastructureActivityInsertWebsocketSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
