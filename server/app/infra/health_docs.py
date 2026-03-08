"""Health docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Entry tool docs — health entry tables, operations
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
from app.routes.v5.tools.entries.health.docs import get_health_docs


async def docs_health_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Health docs using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> profile check
      2. Parallel: entry docs
      3. Assemble ComposedDocsResponse with API operations
    """
    from fastapi import HTTPException

    # -- Step 1: Profile context ------------------------------------------

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Parallel docs fetches ------------------------------------

    (health,) = await asyncio.gather(
        get_health_docs(conn),
    )

    # -- Step 3: Assemble response ----------------------------------------

    # Lazy imports to avoid circular dependencies
    from app.routes.v5.api.main.health.export import export_health
    from app.routes.v5.api.main.health.get import get_health
    from app.routes.v5.api.main.health.refresh import health_refresh

    return ComposedDocsResponse(
        name="health",
        type="analytics",
        description=(
            "Health analytics monitors system performance metrics, "
            "service health indicators, and operational status."
        ),
        entries=[health],
        resources=[],
        permissions=[],
        api_operations=[
            get_operation_info(
                get_health,
                description="POST /get — Get system health metrics and status.",
            ),
            get_operation_info(
                health_refresh,
                description="POST /refresh — Refresh health materialized views.",
            ),
            get_operation_info(
                export_health,
                description="POST /export — Export health data as CSV/ZIP.",
            ),
        ],
    )
