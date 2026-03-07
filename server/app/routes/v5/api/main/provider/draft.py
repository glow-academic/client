"""Provider draft endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.provider_draft.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.provider_draft import patch_provider_draft_client
from app.routes.v5.api.main.provider.types import (
    PatchProviderDraftApiRequest,
    PatchProviderDraftApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchProviderDraftApiResponse,
)
async def patch_provider_draft(
    request: PatchProviderDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchProviderDraftApiResponse:
    """Patch provider draft — composable infra architecture."""
    tags = ["providers", "drafts"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        session_id = http_request.state.session_id
        if not session_id:
            raise HTTPException(
                status_code=401,
                detail="Session ID is required.",
            )

        redis = get_redis_client()
        result = await patch_provider_draft_client(
            conn,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            request=request,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="patch_provider_draft",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
