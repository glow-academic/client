"""Provider new endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

# Reuse models from detail.py
from app.api.v3.providers.detail import ProviderDetailResponse
from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


class ProviderNewRequest(BaseModel):
    """Request for default provider detail."""

    pass
    # profileId removed - comes from X-Profile-Id header


router = APIRouter()


@router.post(
    "/new",
    response_model=ProviderDetailResponse,
    dependencies=[
        audit_activity("provider.new", "{{ actor.name }} viewed new provider form")
    ],
)
async def get_provider_new(
    request_body: ProviderNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProviderDetailResponse:
    """Get default provider detail information for new provider creation."""
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

        sql_query = load_sql("app/sql/v3/providers/get_provider_new_complete.sql")
        sql_params = (uuid.UUID(profile_id),)
        row = await conn.fetchrow(sql_query, uuid.UUID(profile_id))

        if not row:
            raise HTTPException(
                status_code=404, detail="Failed to get default provider data"
            )

        # Get user role for default behavior
        user_role = row.get("user_role", "trainee")
        can_edit = user_role in ("admin", "superadmin")
        can_delete = user_role in ("admin", "superadmin")

        # Set audit context with data from SQL query
        actor_name = row.get("actor_name")
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        response_data = ProviderDetailResponse(
            provider_id=row.get("provider_id", ""),
            name=row.get("name", ""),
            description=row.get("description", ""),
            value=row.get("value", ""),
            active=row.get("active", True),
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
            operation="get_provider_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
