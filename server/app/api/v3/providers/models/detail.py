"""Model detail endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ModelDetailRequest(BaseModel):
    modelId: str
    providerId: str
    profileId: str


class ProviderMappingItem(BaseModel):
    name: str
    description: str


class ModelDetailResponse(BaseModel):
    name: str
    description: str
    active: bool
    custom_model: bool
    image_model: bool
    input_ppm: int
    output_ppm: int
    provider_id: str
    valid_provider_ids: list[str]
    provider_mapping: dict[str, ProviderMappingItem]


router = APIRouter()


@router.post("/detail", response_model=ModelDetailResponse)
async def get_model_detail(
    request: ModelDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ModelDetailResponse:
    """Get detailed model information."""
    tags = ["providers"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ModelDetailResponse.model_validate(cached["data"])
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/providers/get_model_detail_complete.sql")
        sql_params = (request.modelId,)
        model = await conn.fetchrow(sql_query, request.modelId)

        if not model:
            raise HTTPException(status_code=404, detail=f"Model not found: {request.modelId}")

        # Parse valid_provider_ids from array
        valid_provider_ids: list[str] = []
        valid_provider_ids_raw = model.get("valid_provider_ids")
        if valid_provider_ids_raw and isinstance(valid_provider_ids_raw, (list, tuple)):
            valid_provider_ids = [str(pid) for pid in valid_provider_ids_raw if pid]

        # Parse provider_mapping from JSONB
        provider_mapping: dict[str, ProviderMappingItem] = {}
        provider_mapping_data = model.get("provider_mapping")
        if isinstance(provider_mapping_data, str):
            provider_mapping_data = json.loads(provider_mapping_data)
        if provider_mapping_data and isinstance(provider_mapping_data, dict):
            for provider_id, pdata in provider_mapping_data.items():
                if isinstance(pdata, dict):
                    provider_mapping[provider_id] = ProviderMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                    )

        response_data = ModelDetailResponse(
            name=model["name"],
            description=model["description"],
            active=model["active"],
            custom_model=model["custom_model"],
            image_model=model["image_model"],
            input_ppm=int(model["input_ppm"]) if model["input_ppm"] else 0,
            output_ppm=int(model["output_ppm"]) if model["output_ppm"] else 0,
            provider_id=str(model["provider_id"]),
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
            operation="get_model_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

