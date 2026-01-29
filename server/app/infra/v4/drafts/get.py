"""Drafts GET internal function - NOT exposed as HTTP endpoint.

Used internally by profile context 2-pass architecture.
"""

from datetime import datetime
from typing import Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/infra/drafts/get_drafts_complete.sql"


# =============================================================================
# Types
# =============================================================================


class QGetDraftsV4Item(BaseModel):
    """Draft item."""

    id: UUID | None = None
    artifact_type: str | None = None
    payload: dict[str, Any] | None = None
    version: int | None = None
    updated_at: datetime | None = None


class GetDraftsSqlParams(BaseModel):
    """SQL parameters for get drafts."""

    ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.ids,)


class GetDraftsSqlRow(BaseModel):
    """SQL row for get drafts."""

    items: list[QGetDraftsV4Item] | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_drafts_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetDraftsV4Item]:
    """Internal function to fetch drafts by IDs.

    NOTE: This is NOT exposed as an HTTP endpoint.
    Used internally by profile context 2-pass architecture.

    Args:
        conn: Database connection
        ids: List of draft IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of draft items
    """
    if not ids:
        return []

    tags = ["infra", "drafts"]
    cache_key_val = cache_key(
        "infra/drafts/get",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetDraftsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetDraftsSqlParams(ids=ids)
    result = cast(
        GetDraftsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetDraftsV4Item] = result.items if result and result.items else []

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items
