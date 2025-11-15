"""Providers list endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.cache_key import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class ProvidersFilters(BaseModel):
    profileId: str


class ModelItem(BaseModel):
    model_id: str
    name: str
    description: str
    active: bool
    custom_model: bool
    updated_at: str
    can_edit: bool
    can_delete: bool


class ProviderWithModels(BaseModel):
    provider_id: str
    name: str
    description: str
    can_edit: bool
    can_delete: bool
    models: list[ModelItem]


class ProvidersListResponse(BaseModel):
    providers: list[ProviderWithModels]
    # UI-ready facet options (precomputed on server)
    provider_options: list[dict[str, str]]  # Array of {value, label}
    custom_model_options: list[dict[str, str]]  # Array of {value, label}
    status_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


@router.post("/list", response_model=ProvidersListResponse)
async def get_providers_list(
    filters: ProvidersFilters,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProvidersListResponse:
    """Get providers list with nested models (hierarchical)."""
    tags = ["providers"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ProvidersListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/providers/list_providers_complete.sql")
        sql_params = (filters.profileId,)
        providers_result = await conn.fetch(sql_query, filters.profileId)

        providers = []

        for row in providers_result:
            # Parse JSONB models
            models = []
            models_data = row.get("models_json")

            if isinstance(models_data, str):
                models_data = json.loads(models_data)

            if models_data and isinstance(models_data, list):
                for model_obj in models_data:
                    if isinstance(model_obj, dict):
                        total_usage = model_obj.get(
                            "persona_usage_count", 0
                        ) + model_obj.get("agent_usage_count", 0)
                        is_in_use = total_usage > 0

                        updated_at = model_obj.get("updated_at", "")
                        if hasattr(updated_at, "isoformat"):
                            updated_at = updated_at.isoformat()
                        elif not isinstance(updated_at, str):
                            updated_at = str(updated_at)

                        model_item = ModelItem(
                            model_id=model_obj.get("model_id", ""),
                            name=model_obj.get("name", ""),
                            description=model_obj.get("description", ""),
                            active=model_obj.get("active", False),
                            custom_model=model_obj.get("custom_model", False),
                            updated_at=updated_at,
                            can_edit=True,
                            can_delete=not is_in_use,
                        )
                        models.append(model_item)

            provider = ProviderWithModels(
                provider_id=str(row["provider_id"]),
                name=row["name"],
                description=row["description"],
                can_edit=row["can_edit"],
                can_delete=all(m.can_delete for m in models) if models else True,
                models=models,
            )
            providers.append(provider)

        # Build facet options server-side
        provider_options = [
            {"value": p.provider_id, "label": p.name} for p in providers
        ]
        custom_model_options = [
            {"value": "true", "label": "Custom Models"},
            {"value": "false", "label": "Standard Models"},
        ]
        status_options = [
            {"value": "true", "label": "Active"},
            {"value": "false", "label": "Inactive"},
        ]

        response_data = ProvidersListResponse(
            providers=providers,
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
            operation="get_providers_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
