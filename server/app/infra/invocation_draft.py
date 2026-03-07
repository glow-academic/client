"""Invocation draft logic — composable infra architecture.

Core draft function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. create_invocation_draft — entry tool (append-only snapshot)
  3. refresh_invocation_drafts — MV refresh
  4. invalidate_tags — cache invalidation
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.api.main.invocation.types import (
    PatchInvocationDraftApiRequest,
    PatchInvocationDraftApiResponse,
)
from app.routes.v5.tools.entries.invocation_drafts.create import (
    create_invocation_draft,
)
from app.routes.v5.tools.entries.invocation_drafts.refresh import (
    refresh_invocation_drafts,
)
from app.utils.cache.invalidate_tags import invalidate_tags

# ---------------------------------------------------------------------------
# patch_invocation_draft_client — composable infra architecture
# ---------------------------------------------------------------------------


async def patch_invocation_draft_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    session_id: UUID,
    request: PatchInvocationDraftApiRequest,
) -> PatchInvocationDraftApiResponse:
    """Invocation draft using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role
      2. create_invocation_draft entry tool (append-only snapshot)
      3. refresh_invocation_drafts MV
      4. invalidate_tags
    """

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Create draft entry (append-only snapshot) ──────────────

    # Compute new version
    new_version = request.expected_version + 1

    async with conn.transaction():
        result = await create_invocation_draft(
            conn,
            group_id=request.group_id,
            session_id=session_id,
            version=new_version,
            name_ids=request.name_ids,
            description_ids=request.description_ids,
            flag_ids=request.flag_ids,
            key_ids=request.key_ids,
            model_flag_ids=request.model_flag_ids,
            model_position_ids=request.model_position_ids,
            model_rubric_ids=request.model_rubric_ids,
            department_ids=request.department_ids,
            reasoning_level_ids=request.reasoning_level_ids,
            temperature_level_ids=request.temperature_level_ids,
            voice_ids=request.voice_ids,
        )

    # ── Step 3: Refresh MV ─────────────────────────────────────────────

    await refresh_invocation_drafts(conn)

    # ── Step 4: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["benchmark", "drafts"], redis=redis)

    return PatchInvocationDraftApiResponse(
        success=True,
        draft_id=result.id,
        new_version=new_version,
        message="Draft created successfully",
    )
