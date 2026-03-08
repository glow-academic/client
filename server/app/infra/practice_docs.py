"""Practice docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Entry tool docs — practice entry operations
  3. API operations — all public route handlers introspected
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.types import ComposedDocsResponse
from app.infra.profile_identity_context import resolve_profile_identity_context

# Entry tool docs
from app.routes.v5.tools.entries.practice.docs import get_practice_docs


async def docs_practice_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Practice docs using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → profile check
      2. Parallel: entry docs
      3. Assemble ComposedDocsResponse with API operations
    """
    from fastapi import HTTPException

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Parallel docs fetches ──────────────────────────────────

    (practice,) = await asyncio.gather(
        get_practice_docs(conn),
    )

    # ── Step 3: Assemble response ──────────────────────────────────────

    # Lazy imports to avoid circular dependencies
    from app.routes.v5.api.main.practice.export import export_practice
    from app.routes.v5.api.main.practice.get import practice_get
    from app.routes.v5.api.main.practice.list import practice_list

    return ComposedDocsResponse(
        name="practice",
        type="analytics",
        description=(
            "Practice analytics provides self-directed simulation practice views "
            "with history, completion stats, and progress tracking."
        ),
        entries=[practice],
        resources=[],
        permissions=[],
        api_operations=[
            get_operation_info(
                practice_get,
                description="POST /get — Get practice dashboard with personal stats.",
            ),
            get_operation_info(
                practice_list,
                description="POST /list — List practice history entries.",
            ),
            get_operation_info(
                export_practice,
                description="POST /export — Export practice data as CSV/ZIP.",
            ),
        ],
    )
