"""Drafts endpoint — separate from profile context for parallel fetching."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.auth.permissions import convert_draft
from app.api.v4.auth.types import GetDraftsApiResponse
from app.infra.v4.drafts.get import get_drafts_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post("/drafts", response_model=GetDraftsApiResponse)
async def get_drafts(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDraftsApiResponse:
    """Return drafts for the current profile (parallel with /auth/context)."""
    try:
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        if not profile_id:
            return GetDraftsApiResponse(drafts=[])

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        # Resolve draft IDs via the same junction path used by get_profile_context_access_complete.sql
        async with pool.acquire() as c:
            draft_id_rows = await c.fetch(
                """SELECT d.id
                   FROM profile_profiles_junction ppj
                   JOIN profiles_drafts_connection pdc ON pdc.profiles_id = ppj.profiles_id
                   JOIN view_drafts_entry d ON d.id = pdc.draft_id
                   WHERE ppj.profile_id = $1
                   ORDER BY d.updated_at DESC""",
                profile_id,
            )

        draft_ids: list[UUID] = [row["id"] for row in draft_id_rows]

        if not draft_ids:
            return GetDraftsApiResponse(drafts=[])

        async with pool.acquire() as c:
            drafts_raw = await get_drafts_internal(c, draft_ids, bypass_cache)

        return GetDraftsApiResponse(drafts=[convert_draft(d) for d in drafts_raw])

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_drafts",
            request=http_request,
        )
