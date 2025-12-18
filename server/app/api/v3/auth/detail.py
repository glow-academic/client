"""Auth detail endpoint."""

import json
import uuid
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
class AuthDetailRequest(BaseModel):
    authId: str
    # profileId removed - comes from X-Profile-Id header


class AuthItemDetail(BaseModel):
    auth_item_id: str
    name: str
    description: str
    position: int
    active: bool
    value_masked: str  # Masked encrypted value or plain value for non-encrypted
    key_id: str | None = None  # Key ID for encrypted items
    encrypted: bool  # Whether this item is encrypted


class AuthDetailResponse(BaseModel):
    name: str
    description: str
    active: bool
    auth_items: list[AuthItemDetail]
    can_edit: bool


router = APIRouter()


@router.post("/detail", response_model=AuthDetailResponse)
async def get_auth_detail(
    request: AuthDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AuthDetailResponse:
    """Get detailed auth information with nested items and keys."""
    tags = ["auth"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        # Ensure can_edit is present in cached data (for backward compatibility)
        cached_data = cached["data"]
        if "can_edit" not in cached_data:
            cached_data["can_edit"] = False
        return AuthDetailResponse.model_validate(cached_data)

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

        sql_query = load_sql("sql/v3/auth/get_auth_detail_complete.sql")
        sql_params = (uuid.UUID(request.authId), profile_id)
        result = await conn.fetchrow(sql_query, uuid.UUID(request.authId), profile_id)

        if not result:
            # Check if auth exists but user doesn't have access
            auth_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM auth WHERE id = $1)",
                uuid.UUID(request.authId),
            )
            if auth_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this auth entry.",
                )
            raise HTTPException(
                status_code=404, detail=f"Auth not found: {request.authId}"
            )

        # Parse auth_items from JSONB
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
                            position=item_data.get("position", 1),
                            active=item_data.get("active", True),
                            value_masked=item_data.get("value_masked", "****"),
                            key_id=item_data.get("key_id"),
                            encrypted=item_data.get("encrypted", True),
                        )
                    )

        # Get can_edit from SQL
        can_edit = result.get("can_edit", False)

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
            operation="get_auth_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
