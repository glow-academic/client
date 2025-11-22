"""Auth detail-default endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class AuthDetailDefaultRequest(BaseModel):
    profileId: str


# Reuse models from detail.py
from app.api.v3.auth.detail import (  # noqa: E402
    AuthDetailResponse,
    AuthItemDetail,
)

router = APIRouter()


@router.post("/detail-default", response_model=AuthDetailResponse)
async def get_auth_detail_default(
    request: AuthDetailDefaultRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AuthDetailResponse:
    """Get default auth detail for creation mode."""
    tags = ["auth"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        cached_data = cached["data"]
        if "can_edit" not in cached_data:
            cached_data["can_edit"] = True  # Default to True for new auth
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return AuthDetailResponse.model_validate(cached_data)

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/auth/get_auth_detail_default.sql")
        sql_params = (request.profileId,)
        result = await conn.fetchrow(sql_query, request.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail="No default auth found for user"
            )

        # Parse auth_items from JSONB (should be empty for default)
        auth_items: list[AuthItemDetail] = []
        items_data = result.get("auth_items_json")
        if isinstance(items_data, str):
            items_data = json.loads(items_data)
        if items_data and isinstance(items_data, list):
            for item_data in items_data:
                if isinstance(item_data, dict):
                    auth_items.append(
                        AuthItemDetail(
                            auth_item_id=item_data.get("auth_item_id", ""),
                            name=item_data.get("name", ""),
                            description=item_data.get("description", ""),
                            value_masked=item_data.get("value_masked", "****"),
                        )
                    )

        # Get user role for default behavior
        user_role = result.get("user_role", "trainee")
        can_edit = user_role in ("admin", "superadmin")

        response_data = AuthDetailResponse(
            name=result["name"],
            description=result["description"],
            active=result["active"],
            auth_items=auth_items,
            can_edit=can_edit,
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
            operation="get_auth_detail_default",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

