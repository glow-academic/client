"""Activity docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Entry tool docs — activity entries
  3. Permission functions — none for activity
  4. API operations — all public route handlers introspected
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.types import ComposedDocsResponse
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.entries.activity.docs import get_activity_docs
from app.utils.docs_helper import PageMetadataConfig, compute_docs_metadata

_PAGE_METADATA = PageMetadataConfig(
    list_title="Activity",
    list_description="Track user engagement and usage metrics.",
    detail_title="Activity",
    detail_description="View activity analytics for a profile.",
    new_title="Activity",
    new_description="Track user engagement and usage metrics.",
)


async def docs_activity_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
) -> ComposedDocsResponse:
    """Activity docs using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> profile check
      2. Entry docs fetch
      3. Assemble ComposedDocsResponse with API operations
    """
    from fastapi import HTTPException

    # -- Step 1: Profile context -----------------------------------------------

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Entry docs ----------------------------------------------------

    (activity_entry,) = await asyncio.gather(
        get_activity_docs(conn),
    )

    # -- Page metadata ---------------------------------------------------------

    page_metadata = compute_docs_metadata(_PAGE_METADATA)

    # -- Step 3: Assemble response ---------------------------------------------

    # Lazy imports to avoid circular dependencies
    from app.routes.v5.api.main.activity.export import export_activity
    from app.routes.v5.api.main.activity.get import get_activity
    from app.routes.v5.api.main.activity.list import list_activity
    from app.routes.v5.api.main.activity.problem import create_problem
    from app.routes.v5.api.main.activity.refresh import activity_refresh
    from app.routes.v5.api.main.activity.resolve import resolve_problem

    return ComposedDocsResponse(
        name="activity",
        type="analytics",
        description=(
            "Activity analytics tracks user engagement, login patterns, "
            "problem flags, and usage metrics across the platform."
        ),
        entries=[activity_entry],
        resources=[],
        permissions=[],
        api_operations=[
            get_operation_info(
                get_activity,
                description="POST /get — Get activity analytics for a profile.",
            ),
            get_operation_info(
                list_activity,
                description="POST /list — List activity history with filters.",
            ),
            get_operation_info(
                resolve_problem,
                description="POST /resolve — Resolve a flagged problem.",
            ),
            get_operation_info(
                create_problem,
                description="POST /problem — Create a new problem flag.",
            ),
            get_operation_info(
                activity_refresh,
                description="POST /refresh — Refresh activity materialized views.",
            ),
            get_operation_info(
                export_activity,
                description="POST /export — Export activity data as CSV/ZIP.",
            ),
        ],
        page_metadata=page_metadata,
    )
