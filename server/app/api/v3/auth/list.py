"""Auth list endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class AuthFilters(BaseModel):
    pass
    # profileId removed - comes from X-Profile-Id header


class AuthSampleItem(BaseModel):
    auth_item_id: str
    name: str
    description: str


class AuthItem(BaseModel):
    auth_id: str
    name: str
    description: str
    active: bool
    num_items: int
    sample_items: list[AuthSampleItem]
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class AuthListResponse(BaseModel):
    auths: list[AuthItem]


router = APIRouter()


@router.post(
    "/list",
    response_model=AuthListResponse,
    dependencies=[audit_activity("auth.list", "{{ actor.name }} viewed auth list")],
)
async def get_auth_list(
    filters: AuthFilters,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AuthListResponse:
    """Get auth list with item counts and permissions."""
    tags = ["auth"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return AuthListResponse.model_validate(cached["data"])

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

        sql_query = load_sql("sql/v3/auth/list_auth.sql")
        sql_params = (profile_id,)
        result = await conn.fetch(sql_query, profile_id)

        # Get actor name from first row (same for all rows)
        actor_name = result[0]["actor_name"] if result else None

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        auths = []

        for row in result:
            # Parse sample items from JSONB
            sample_items = []
            if row.get("sample_items_json"):
                items_data = row["sample_items_json"]
                if isinstance(items_data, str):
                    items_data = json.loads(items_data)
                if isinstance(items_data, list):
                    for item_data in items_data:
                        if isinstance(item_data, dict):
                            sample_items.append(
                                AuthSampleItem(
                                    auth_item_id=item_data.get("auth_item_id", ""),
                                    name=item_data.get("name", ""),
                                    description=item_data.get("description", ""),
                                )
                            )

            auths.append(
                AuthItem(
                    auth_id=str(row["auth_id"]),
                    name=row["name"],
                    description=row["description"],
                    active=row["active"],
                    num_items=row["num_items"],
                    sample_items=sample_items,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

        response_data = AuthListResponse(auths=auths)

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
            operation="get_auth_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
