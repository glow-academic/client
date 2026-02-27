"""Shared cached access resolver for auth endpoints."""

from __future__ import annotations

import json
from typing import cast
from uuid import UUID

import asyncpg
from fastapi import HTTPException

from app.registry.artifact_entries import ARTIFACT_ENTRIES
from app.sql.types import (
    GetProfileContextAccessSqlParams,
    GetProfileContextAccessSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_ACCESS_PATH = "app/sql/v4/queries/profile/get_profile_context_access_complete.sql"

CACHE_TAGS = ["auth", "access"]
CACHE_TTL = 60


async def get_access_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None,
    bypass_cache: bool = False,
) -> GetProfileContextAccessSqlRow:
    """Resolve and cache the Pass 1 access row.

    All three split endpoints call this; first pays SQL cost, others hit Redis.
    Includes authorization checks (raises 404 for missing/unauthorized profile).
    """
    params = GetProfileContextAccessSqlParams(
        profile_id=profile_id,
        department_id=None,
        p_artifact_entries=json.dumps(ARTIFACT_ENTRIES),
    )

    # Cache lookup
    cache_key_val = cache_key(
        "/api/v4/auth/access",
        {
            "profile_id": str(profile_id) if profile_id else None,
        },
    )
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetProfileContextAccessSqlRow(**cached["data"])

    access_result = cast(
        GetProfileContextAccessSqlRow | None,
        await execute_sql_typed(conn, SQL_ACCESS_PATH, params=params),
    )

    # Authorization checks
    if not profile_id:
        raise HTTPException(
            status_code=404,
            detail="Profile context not found: Could not resolve profile. Please try logging in again.",
        )

    if profile_id and (not access_result or not access_result.is_authorized):
        raise HTTPException(
            status_code=404,
            detail=f"Profile context not found: {profile_id}",
        )

    if not access_result:
        raise HTTPException(status_code=404, detail="Profile context not found")

    # Cache the result
    if not bypass_cache:
        await set_cached(
            cache_key_val,
            {"data": access_result.model_dump(mode="json")},
            ttl=CACHE_TTL,
            tags=CACHE_TAGS,
        )

    return access_result
