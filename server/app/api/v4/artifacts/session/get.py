"""Session detail endpoint - POST /artifacts/session/get.

Imports from views/artifacts/session_detail internal function and adds
resource hydration.
"""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.session.types import (
    GetSessionDetailRequest,
    GetSessionDetailResponse,
)
from app.api.v4.views.artifacts.session_detail.get import get_artifact_session_detail_internal
from app.api.v4.views.artifacts.session_detail.types import (
    ArtifactSessionAudit,
    ArtifactSessionGroup,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


@router.post(
    "/get",
    response_model=GetSessionDetailResponse,
    dependencies=[
        audit_activity(
            "artifacts.session.get", "{{ actor.name }} viewed session detail"
        )
    ],
)
async def get_session(
    request: GetSessionDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSessionDetailResponse:
    """Get session detail with paginated audits and groups."""
    tags = ["artifacts", "session"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Check for cached response
        body_dict = request.model_dump(mode="json")
        body_dict["profile_id"] = str(profile_id)
        cache_key_val = cache_key(http_request.url.path, body_dict)

        if not bypass_cache:
            cached = await get_cached(cache_key_val)
            if cached:
                response.headers["X-Cache-Tags"] = ",".join(tags)
                response.headers["X-Cache-Hit"] = "1"
                return GetSessionDetailResponse.model_validate(cached["data"])

        # Fetch from views layer
        view_result = await get_artifact_session_detail_internal(
            conn=conn,
            session_id=request.session_id,
            profile_id=profile_id,
            audit_limit=request.audit_limit,
            audit_offset=request.audit_offset,
            bypass_cache=bypass_cache,
        )

        if not view_result.session_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Session not found: {request.session_id}",
            )

        # Set audit context
        if view_result.actor_name:
            audit_set(http_request, actor={"name": view_result.actor_name, "id": profile_id})

        api_response = GetSessionDetailResponse(
            actor_name=view_result.actor_name,
            session_exists=view_result.session_exists,
            session_id=view_result.session_id,
            profile_id=view_result.profile_id,
            profile_name=view_result.profile_name,
            session_created_at=view_result.session_created_at,
            active=view_result.active,
            audit_total_count=view_result.audit_total_count,
            audits=view_result.audits,
            groups=view_result.groups,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_session_get",
            request=http_request,
        )
