"""Settings active endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class SettingsActiveRequest(BaseModel):
    """Request to get active settings."""

    profileId: str


class SettingsActiveResponse(BaseModel):
    """Active settings response."""

    settings_id: str
    created_at: str
    active: bool
    color: str
    organization_name: str


router = APIRouter()


@router.post("/active", response_model=SettingsActiveResponse)
async def get_active_settings(
    request: SettingsActiveRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SettingsActiveResponse:
    """Get active settings information."""
    tags = ["settings"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SettingsActiveResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/settings/get_active_settings.sql")
        sql_params = ()  # No parameters for this query
        settings = await conn.fetchrow(sql_query)

        if not settings:
            raise HTTPException(
                status_code=404, detail="No active settings found"
            )

        response_data = SettingsActiveResponse(
            settings_id=settings["settings_id"],
            created_at=settings["created_at"].isoformat()
            if settings["created_at"]
            else "",
            active=settings["active"],
            color=settings["color"],
            organization_name=settings["organization_name"],
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
            route_path=http_request.url.path,
            operation="get_active_settings",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

