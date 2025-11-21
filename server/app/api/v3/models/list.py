"""Models list endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class ModelsFilters(BaseModel):
    profileId: str


class ModelItem(BaseModel):
    model_id: str
    name: str
    description: str
    active: bool
    custom_model: bool
    image_model: bool
    updated_at: str
    provider_id: str
    provider_name: str
    provider_description: str
    can_edit: bool
    can_delete: bool


class ProviderMappingItem(BaseModel):
    name: str
    description: str


class ModelsListResponse(BaseModel):
    models: list[ModelItem]
    provider_mapping: dict[str, ProviderMappingItem]
    provider_options: list[dict[str, str]]  # Array of {value, label}
    custom_model_options: list[dict[str, str]]  # Array of {value, label}
    status_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


@router.post("/list", response_model=ModelsListResponse)
async def get_models_list(
    filters: ModelsFilters,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ModelsListResponse:
    """Get models list (flat structure with provider info)."""
    tags = ["models"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ModelsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/models/list_models_complete.sql")
        sql_params = (filters.profileId,)
        models_result = await conn.fetch(sql_query, filters.profileId)

        models = []
        provider_mapping: dict[str, ProviderMappingItem] = {}

        # Parse provider_mapping from first row (same for all rows)
        if models_result:
            provider_mapping_data = models_result[0].get("provider_mapping")
            if isinstance(provider_mapping_data, str):
                provider_mapping_data = json.loads(provider_mapping_data)
            if provider_mapping_data and isinstance(provider_mapping_data, dict):
                for provider_id, pdata in provider_mapping_data.items():
                    if isinstance(pdata, dict):
                        provider_mapping[provider_id] = ProviderMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                        )

        for row in models_result:
            updated_at = row.get("updated_at", "")
            if hasattr(updated_at, "isoformat"):
                updated_at = updated_at.isoformat()
            elif not isinstance(updated_at, str):
                updated_at = str(updated_at)

            model_item = ModelItem(
                model_id=str(row["model_id"]),
                name=row["name"],
                description=row["description"],
                active=row["active"],
                custom_model=row["custom_model"],
                image_model=row["image_model"],
                updated_at=updated_at,
                provider_id=str(row["provider_id"]),
                provider_name=row["provider_name"],
                provider_description=row["provider_description"],
                can_edit=row["can_edit"],
                can_delete=row["can_delete"],
            )
            models.append(model_item)

        # Build facet options server-side
        # Get unique providers from models
        provider_set = {
            (m.provider_id, m.provider_name) for m in models
        }
        provider_options = [
            {"value": pid, "label": pname} for pid, pname in sorted(provider_set, key=lambda x: x[1])
        ]

        custom_model_options = [
            {"value": "true", "label": "Custom Models"},
            {"value": "false", "label": "Standard Models"},
        ]
        status_options = [
            {"value": "true", "label": "Active"},
            {"value": "false", "label": "Inactive"},
        ]

        response_data = ModelsListResponse(
            models=models,
            provider_mapping=provider_mapping,
            provider_options=provider_options,
            custom_model_options=custom_model_options,
            status_options=status_options,
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
            operation="get_models_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

