"""Units list endpoint for model configuration."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error


# Inline request/response schemas
class UnitsListRequest(BaseModel):
    profileId: str


class UnitItem(BaseModel):
    id: str
    name: str
    unit_category: str  # 'tokens' | 'seconds' | 'units'
    value: int


class UnitsListResponse(BaseModel):
    units: list[UnitItem]


router = APIRouter()


@router.post("/list", response_model=UnitsListResponse)
async def get_units_list(
    request: UnitsListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UnitsListResponse:
    """Get list of all active units."""
    tags = ["units"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return UnitsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = "SELECT id::text, name, unit_category::text, value FROM units WHERE active = true ORDER BY unit_category, value, name"
        sql_params = ()
        rows = await conn.fetch(sql_query)

        units: list[UnitItem] = []
        for row in rows:
            units.append(
                UnitItem(
                    id=str(row["id"]),
                    name=str(row["name"]),
                    unit_category=str(row["unit_category"]),
                    value=int(row["value"]),
                )
            )

        response_data = UnitsListResponse(units=units)

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=300,  # Cache units for 5 minutes (they don't change often)
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
            operation="get_units_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
