"""Provider detail endpoint."""

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
class ProviderDetailRequest(BaseModel):
    providerId: str
    profileId: str


class ProviderDetailResponse(BaseModel):
    name: str
    description: str
    api_key: str
    base_url: str | None


router = APIRouter()


@router.post("/detail", response_model=ProviderDetailResponse)
async def get_provider_detail(
    request: ProviderDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProviderDetailResponse:
    """Get detailed provider information."""
    tags = ["providers"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ProviderDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/providers/get_provider_detail_complete.sql")
        sql_params = (request.providerId,)
        provider = await conn.fetchrow(sql_query, request.providerId)

        if not provider:
            raise HTTPException(
                status_code=404, detail=f"Provider not found: {request.providerId}"
            )

        response_data = ProviderDetailResponse(
            name=provider["name"],
            description=provider["description"],
            api_key=provider["api_key"],  # Returned encrypted
            base_url=provider["base_url"],
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
            operation="get_provider_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
