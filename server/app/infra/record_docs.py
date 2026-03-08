"""Record docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. API operations — all public route handlers introspected
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.types import ComposedDocsResponse
from app.infra.profile_identity_context import resolve_profile_identity_context


async def docs_record_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Record docs using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> profile check
      2. Assemble ComposedDocsResponse with API operations
    """
    from fastapi import HTTPException

    # -- Step 1: Profile context ------------------------------------------

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Assemble response ----------------------------------------

    # Lazy imports to avoid circular dependencies
    from app.routes.v5.api.main.record.export import export_record
    from app.routes.v5.api.main.record.get import get_record
    from app.routes.v5.api.main.record.list import list_record

    return ComposedDocsResponse(
        name="record",
        type="analytics",
        description=(
            "Record analytics provides per-profile performance dashboards "
            "with attempt history, scoring trends, and progress tracking."
        ),
        entries=[],
        resources=[],
        permissions=[],
        api_operations=[
            get_operation_info(
                get_record,
                description="POST /get — Get record dashboard for a specific profile.",
            ),
            get_operation_info(
                list_record,
                description="POST /list — List record history entries.",
            ),
            get_operation_info(
                export_record,
                description="POST /export — Export record data as CSV/ZIP.",
            ),
        ],
    )
