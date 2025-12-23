"""Settings list endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline request/response schemas
class SettingsListRequest(BaseModel):
    pass
    # profileId removed - comes from X-Profile-Id header


class SettingsItem(BaseModel):
    """Settings item."""

    settings_id: str
    created_at: str
    active: bool
    name: str
    description: str
    department_ids: list[str] | None = None


class SettingsListResponse(BaseModel):
    settings: list[SettingsItem]


router = APIRouter()


@router.post(
    "/list",
    response_model=SettingsListResponse,
    dependencies=[
        audit_activity("settings.list", "{{ actor.name }} visited the Settings page")
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/settings/list_settings.sql")
        sql_params = (profile_id,)
        rows = await conn.fetch(sql_query, profile_id)

        # Get actor_name from first row (same for all rows)
        actor_name = rows[0]["actor_name"] if rows else None

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        settings_items: list[SettingsItem] = []
        for row in rows:
            # Convert UUID array to string array or None
            department_ids = None
            if row.get("department_ids"):
                department_ids = [str(did) for did in row["department_ids"]]

            settings_items.append(
                SettingsItem(
                    settings_id=row["settings_id"],
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                    active=row["active"],
                    name=row["name"],
                    description=row["description"],
                    department_ids=department_ids,
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
