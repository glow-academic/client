"""Settings list endpoint."""

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
class SettingsListRequest(BaseModel):
    profileId: str


class SettingsItem(BaseModel):
    """Settings item."""

    settings_id: str
    created_at: str
    active: bool


class SettingsListResponse(BaseModel):
    settings: list[SettingsItem]


router = APIRouter()


@router.post("/list", response_model=SettingsListResponse)
async def list_settings(
    request: SettingsListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SettingsListResponse:
    """Get list of all settings ordered by created_at DESC."""
    tags = ["settings"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SettingsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/settings/list_settings.sql")
        sql_params = ()  # No parameters for this query
        rows = await conn.fetch(sql_query)

        settings_items: list[SettingsItem] = []
        for row in rows:
            settings_items.append(
                SettingsItem(
                    settings_id=row["settings_id"],
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                    active=row["active"],
                )
            )

        response_data = SettingsListResponse(settings=settings_items)

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
            operation="list_settings",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

