"""Keys detail endpoint."""

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
class KeyDetailRequest(BaseModel):
    keyId: str
    show_full: bool = False  # If True, return full key; otherwise masked


class KeyDetailResponse(BaseModel):
    key_id: str
    name: str
    key: str  # Full key if show_full=True, masked otherwise
    key_masked: str  # Always masked
    type: str
    active: bool


router = APIRouter()


@router.post("/detail", response_model=KeyDetailResponse)
async def get_key_detail(
    request: KeyDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> KeyDetailResponse:
    """Get key details (with masking option)."""
    tags = ["keys"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (but don't cache full keys)
    if not request.show_full:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return KeyDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/keys/get_key_detail.sql")
        sql_params = (request.keyId, request.show_full)
        result = await conn.fetchrow(sql_query, request.keyId, request.show_full)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Key not found: {request.keyId}"
            )

        # Return full key only if show_full=True
        key_value = result["key"] if request.show_full else result["key_masked"]

        response_data = KeyDetailResponse(
            key_id=str(result["key_id"]),
            name=result["name"],
            key=key_value,
            key_masked=result["key_masked"],
            type=result["type"],
            active=result["active"],
        )

        # Only cache if not showing full key
        if not request.show_full:
            await set_cached(
                cache_key_val,
                {"data": response_data.model_dump()},
                ttl=60,
                tags=tags,
            )
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "0"
        else:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_key_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

