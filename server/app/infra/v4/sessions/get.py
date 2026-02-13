"""Sessions GET internal function - NOT exposed as HTTP endpoint.

Used internally by profile context 2-pass architecture.
"""

from typing import Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/infra/sessions/get_session_complete.sql"


class GetSessionSqlParams(BaseModel):
    p_profile_id: UUID | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.p_profile_id,)


class GetSessionSqlRow(BaseModel):
    session_id: UUID | None = None


async def get_session_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> UUID | None:
    """Internal function to fetch the most recent session for a profile.

    Args:
        conn: Database connection
        profile_id: Profile ID to look up session for
        bypass_cache: Whether to bypass cache

    Returns:
        Session UUID or None if no session found
    """
    tags = ["infra", "sessions"]
    cache_key_val = cache_key(
        "infra/sessions/get",
        {"profile_id": str(profile_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached is not None:
            sid = cached.get("session_id")
            return UUID(sid) if sid else None

    params = GetSessionSqlParams(p_profile_id=profile_id)
    result = cast(
        GetSessionSqlRow | None,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    session_id = result.session_id if result else None

    await set_cached(
        cache_key_val,
        {"session_id": str(session_id) if session_id else None},
        ttl=60,
        tags=tags,
    )

    return session_id
