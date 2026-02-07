"""Get endpoint for artifact session detail (api_get_artifact_session_detail_v4)."""

from decimal import Decimal
from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.artifacts.session_detail.types import (
    ArtifactSessionAudit,
    ArtifactSessionGroup,
    GetArtifactSessionDetailRequest,
    GetArtifactSessionDetailResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetArtifactSessionDetailSqlParams,
    GetArtifactSessionDetailSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/artifacts/session/get_artifact_session_detail_complete.sql"
)

router = APIRouter()


async def get_artifact_session_detail_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    profile_id: UUID,
    audit_limit: int = 50,
    audit_offset: int = 0,
    bypass_cache: bool = False,
) -> GetArtifactSessionDetailResponse:
    """Internal function for fetching artifact session detail."""
    cache_key_val = cache_key(
        "views/artifacts/session_detail/get",
        {
            "session_id": str(session_id),
            "profile_id": str(profile_id),
            "audit_limit": audit_limit,
            "audit_offset": audit_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetArtifactSessionDetailResponse.model_validate(cached)

    params = GetArtifactSessionDetailSqlParams(
        p_session_id=session_id,
        p_profile_id=profile_id,
        p_audit_limit=audit_limit,
        p_audit_offset=audit_offset,
    )

    result = cast(
        GetArtifactSessionDetailSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    audits = []
    if result.audits:
        for a in result.audits:
            audits.append(
                ArtifactSessionAudit(
                    id=a.id,
                    created_at=a.created_at,
                    message=a.message,
                    endpoint=a.endpoint,
                    error=a.error or False,
                )
            )

    groups = []
    if result.groups:
        for g in result.groups:
            groups.append(
                ArtifactSessionGroup(
                    group_id=g.group_id,
                    group_name=g.group_name,
                    trace_id=g.trace_id,
                    first_run_at=g.first_run_at,
                    last_run_at=g.last_run_at,
                    run_count=g.run_count or 0,
                    total_tokens=g.total_tokens or 0,
                    total_cost=Decimal(str(g.total_cost))
                    if g.total_cost
                    else Decimal("0"),
                )
            )

    response = GetArtifactSessionDetailResponse(
        actor_name=result.actor_name,
        session_exists=result.session_exists or False,
        session_id=result.session_id,
        profile_id=result.profile_id,
        profile_name=result.profile_name,
        session_created_at=result.session_created_at,
        active=result.active or False,
        audit_total_count=result.audit_total_count or 0,
        audits=audits,
        groups=groups,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "artifacts", "session_detail"],
    )

    return response


@router.post(
    "/get",
    response_model=GetArtifactSessionDetailResponse,
    dependencies=[
        audit_activity(
            "views.artifacts.session_detail.get",
            "{{ actor.name }} fetched artifact session detail data",
        )
    ],
)
async def get_artifact_session_detail(
    request: GetArtifactSessionDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetArtifactSessionDetailResponse:
    """Get artifact session detail from api_get_artifact_session_detail_v4."""
    tags = ["views", "artifacts", "session_detail"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        result = await get_artifact_session_detail_internal(
            conn=conn,
            session_id=request.session_id,
            profile_id=profile_id,
            audit_limit=request.audit_limit,
            audit_offset=request.audit_offset,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_artifacts_session_detail_get",
            request=http_request,
        )
