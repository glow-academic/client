"""Field draft endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.field_draft.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.field_draft import patch_field_draft_client
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.field.types import (
    PatchFieldDraftApiRequest,
    PatchFieldDraftApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchFieldDraftApiResponse,
)
async def patch_field_draft(
    request: PatchFieldDraftApiRequest,
    http_request: Request,
    response: Response,
) -> PatchFieldDraftApiResponse:
    """Patch field draft — composable infra architecture."""
    tags = ["fields", "drafts"]

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

        pool = get_pool()
        redis = get_redis_client()
        result = await patch_field_draft_client(
            pool,
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
            operation="patch_field_draft",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
