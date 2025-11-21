"""Model detail-default endpoint for create page."""

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
class ModelDetailDefaultRequest(BaseModel):
    profileId: str


class ProviderMappingItem(BaseModel):
    name: str
    description: str


class ModelDetailDefaultResponse(BaseModel):
    valid_provider_ids: list[str]
    provider_mapping: dict[str, ProviderMappingItem]


router = APIRouter()


@router.post("/detail-default", response_model=ModelDetailDefaultResponse)
async def get_model_detail_default(
    request: ModelDetailDefaultRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ModelDetailDefaultResponse:
    """Get default model detail for creation mode (provider mapping)."""
    tags = ["models"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ModelDetailDefaultResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/models/detail_default.sql")
        sql_params = None
        result = await conn.fetchrow(sql_query)

        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to fetch provider mapping"
            )

        # Parse valid_provider_ids from array
        valid_provider_ids: list[str] = []
        valid_provider_ids_raw = result.get("valid_provider_ids")
        if valid_provider_ids_raw and isinstance(valid_provider_ids_raw, (list, tuple)):
            valid_provider_ids = [str(pid) for pid in valid_provider_ids_raw if pid]

        # Parse provider_mapping from JSONB
        provider_mapping: dict[str, ProviderMappingItem] = {}
        provider_mapping_data = result.get("provider_mapping")
        if isinstance(provider_mapping_data, str):
            provider_mapping_data = json.loads(provider_mapping_data)
        if provider_mapping_data and isinstance(provider_mapping_data, dict):
            for provider_id, pdata in provider_mapping_data.items():
                if isinstance(pdata, dict):
                    provider_mapping[provider_id] = ProviderMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                    )

        response_data = ModelDetailDefaultResponse(
            valid_provider_ids=valid_provider_ids,
            provider_mapping=provider_mapping,
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
            operation="get_model_detail_default",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

