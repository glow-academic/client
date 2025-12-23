"""Models list endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ModelsFilters(BaseModel):
    pass
    # profileId removed - comes from X-Profile-Id header


class ModelItem(BaseModel):
    model_id: str
    name: str
    description: str
    active: bool
    image_model: bool
    updated_at: str
    provider: str  # provider value from providers table
    provider_id: str  # provider UUID
    provider_name: str  # provider display name
    base_url: str  # empty string if not custom model
    can_edit: bool
    can_delete: bool


class ModelsListResponse(BaseModel):
    models: list[ModelItem]
    provider_options: list[dict[str, str]]  # Array of {value, label} for enum values
    status_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


@router.post(
    "/list",
    response_model=ModelsListResponse,
    dependencies=[
        audit_activity("models.list", "{{ actor.name }} visited the Models page")
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("sql/v3/models/list_models_complete.sql")
        sql_params = (profile_id,)
        models_result = await conn.fetch(sql_query, profile_id)

        # Get actor name from first row (same for all rows)
        actor_name = models_result[0]["actor_name"] if models_result else None

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        models = []

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
                image_model=row["image_model"],
                updated_at=updated_at,
                provider=str(row["provider"]),
                provider_id=str(row.get("provider_id", "")),
                provider_name=str(row.get("provider_name", "")),
                base_url=str(row.get("base_url", "")),
                can_edit=row["can_edit"],
                can_delete=row["can_delete"],
            )
            models.append(model_item)

        # Build facet options server-side from providers table
        provider_options_query = (
            "SELECT value, name FROM providers WHERE active = true ORDER BY name"
        )
        provider_rows = await conn.fetch(provider_options_query)
        provider_options = [
            {"value": str(row["value"]), "label": row["name"]} for row in provider_rows
        ]

        status_options = [
            {"value": "true", "label": "Active"},
            {"value": "false", "label": "Inactive"},
        ]

        response_data = ModelsListResponse(
            models=models,
            provider_options=provider_options,
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
