"""Keys list endpoint."""

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
class KeysFilters(BaseModel):
    type: str = "auth"  # Filter by key type


class KeyItem(BaseModel):
    key_id: str
    key_masked: str  # Masked key (first 4 chars + "****")
    type: str
    active: bool


class KeysListResponse(BaseModel):
    keys: list[KeyItem]
    key_mapping: dict[str, dict[str, Any]]  # Mapping for picker use


router = APIRouter()


@router.post("/list", response_model=KeysListResponse)
async def get_keys_list(
    filters: KeysFilters,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> KeysListResponse:
    """Get keys list filtered by type."""
    tags = ["keys"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return KeysListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/keys/list_keys.sql")
        sql_params = (filters.type,)
        result = await conn.fetch(sql_query, filters.type)

        keys = []
        key_mapping: dict[str, dict[str, Any]] = {}

        for row in result:
            key_id = str(row["key_id"])
            key_masked = row["key_masked"]
            key_type = row["type"]
            active = row["active"]

            keys.append(
                KeyItem(
                    key_id=key_id,
                    key_masked=key_masked,
                    type=key_type,
                    active=active,
                )
            )

            # Build mapping for picker use
            key_mapping[key_id] = {
                "key_masked": key_masked,
                "active": active,
            }

        response_data = KeysListResponse(keys=keys, key_mapping=key_mapping)

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
            operation="get_keys_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

