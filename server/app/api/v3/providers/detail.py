"""Provider detail endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql


class ProviderDetailRequest(BaseModel):
    """Request for provider detail."""

    providerId: str
    # profileId removed - comes from X-Profile-Id header


class ProviderDetailResponse(BaseModel):
    """Response for provider detail endpoint."""

    provider_id: str
    name: str
    description: str
    value: str
    active: bool
    created_at: str
    updated_at: str
    base_url: str
    can_edit: bool
    can_delete: bool


router = APIRouter()


@router.post(
    "/detail",
    response_model=ProviderDetailResponse,
    dependencies=[
        audit_activity(
            "provider.viewed", "{{ actor.name }} viewed provider '{{ provider.name }}'"
        )
    ],
)
async def get_provider_detail(
    request_body: ProviderDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProviderDetailResponse:
    """Get provider detail information."""
    tags = ["providers"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ProviderDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/providers/get_provider_detail_complete.sql")
        sql_params = (
            uuid.UUID(request_body.providerId),
            uuid.UUID(profile_id),
        )
        row = await conn.fetchrow(
            sql_query,
            uuid.UUID(request_body.providerId),
            uuid.UUID(profile_id),
        )

        if not row:
            # Check if provider exists
            provider_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM providers WHERE id = $1)",
                uuid.UUID(request_body.providerId),
            )
            if provider_exists:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this provider.",
                )
            raise HTTPException(status_code=404, detail="Provider not found")

        # Get can_edit and can_delete from SQL
        can_edit = row.get("can_edit", False)
        can_delete = row.get("can_delete", False)

        # Set audit context with data from SQL query
        actor_name = row.get("actor_name")
        provider_name = row.get("name")
        if actor_name:
            audit_set(
                request,
                actor={"name": actor_name, "id": profile_id},
                provider={"name": provider_name, "id": request_body.providerId},
            )

        response_data = ProviderDetailResponse(
            provider_id=str(row.get("provider_id", "")),
            name=row.get("name", ""),
            description=row.get("description", ""),
            value=row.get("value", ""),
            active=row.get("active", False),
            created_at=row.get("created_at").isoformat()
            if row.get("created_at")
            else "",
            updated_at=row.get("updated_at").isoformat()
            if row.get("updated_at")
            else "",
            base_url=row.get("base_url", ""),
            can_edit=can_edit,
            can_delete=can_delete,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_provider_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
