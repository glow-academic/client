"""Attempt docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Entry tool docs — attempt entries
  3. Permission functions — attempt access, display, aggregates, scoring
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
from app.routes.v5.tools.entries.attempt.docs import get_attempt_docs


async def docs_attempt_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Attempt docs using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> profile check
      2. Entry docs fetch
      3. Assemble ComposedDocsResponse with permissions + API operations
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

    (attempt_entry,) = await asyncio.gather(
        get_attempt_docs(conn),
    )

    # -- Step 3: Assemble response ---------------------------------------------

    # Lazy imports to avoid circular dependencies
    from app.infra.attempt_permissions import (
        check_attempt_access,
        compute_achieved_standards,
        compute_attempt_aggregates,
        compute_chat_position_and_current,
        compute_content_display,
        compute_continuation_options,
        compute_current_chat_index,
        compute_passed_standards,
        compute_percentage,
        compute_total_possible_points,
        compute_total_time_limit,
    )
    from app.routes.v5.api.main.attempt.archive import archive_attempts
    from app.routes.v5.api.main.attempt.export import export_attempt
    from app.routes.v5.api.main.attempt.get import attempt_get

    return ComposedDocsResponse(
        name="attempt",
        type="analytics",
        description=(
            "Attempt analytics provides detailed views of simulation attempts "
            "including chat history, scoring, standards achievement, and "
            "completion status."
        ),
        entries=[attempt_entry],
        resources=[],
        permissions=[
            get_operation_info(
                check_attempt_access,
                description="Check if the requesting user has access to the attempt.",
            ),
            get_operation_info(
                compute_content_display,
                description="Compute display name, color, and icon for a content item.",
            ),
            get_operation_info(
                compute_chat_position_and_current,
                description="Compute position and is_current for each chat in-place.",
            ),
            get_operation_info(
                compute_attempt_aggregates,
                description="Compute attempt-level aggregates from chats.",
            ),
            get_operation_info(
                compute_total_possible_points,
                description="Compute total possible points from completed chats.",
            ),
            get_operation_info(
                compute_percentage,
                description="Compute percentage score.",
            ),
            get_operation_info(
                compute_current_chat_index,
                description="Compute the current chat index.",
            ),
            get_operation_info(
                compute_total_time_limit,
                description="Compute total time limit from all chats.",
            ),
            get_operation_info(
                compute_achieved_standards,
                description="Derive achieved standards from feedbacks.",
            ),
            get_operation_info(
                compute_passed_standards,
                description="Derive passed standards from feedbacks and pass_points.",
            ),
            get_operation_info(
                compute_continuation_options,
                description="Compute available continuation options from previous attempt chats.",
            ),
        ],
        api_operations=[
            get_operation_info(
                attempt_get,
                description="POST /get — Get a single attempt with full detail.",
            ),
            get_operation_info(
                archive_attempts,
                description="POST /archive — Archive completed attempts.",
            ),
            get_operation_info(
                export_attempt,
                description="POST /export — Export attempt data as CSV/ZIP.",
            ),
        ],
    )
