"""Providers list endpoint - v3 API following DHH principles."""

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


class ProvidersListRequest(BaseModel):
    """Request for providers list."""

    profileId: str


class ProviderItem(BaseModel):
    """Provider item for list view."""

    provider_id: str
    name: str
    description: str
    value: str
    active: bool
    created_at: str
    updated_at: str
    base_url: str
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class ProvidersListResponse(BaseModel):
    """Response for providers list."""

    providers: list[ProviderItem]
    provider_options: list[dict[str, str]]
    status_options: list[dict[str, str]]


router = APIRouter()


@router.post("/list", response_model=ProvidersListResponse)
async def get_providers_list(
    filters: ProvidersListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProvidersListResponse:
    """Get providers list with permissions and endpoint info."""
    tags = ["providers"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ProvidersListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/providers/list_providers.sql")
        sql_params = (filters.profileId,)
        rows = await conn.fetch(sql_query, filters.profileId)

        providers = []
        provider_options: list[dict[str, str]] = []
        status_options: list[dict[str, str]] = []

        for row in rows:
            providers.append(
                ProviderItem(
                    provider_id=str(row["provider_id"]),
                    name=row["name"],
                    description=row.get("description", ""),
                    value=row["value"],
                    active=row["active"],
                    created_at=row["created_at"].isoformat()
                    if row.get("created_at")
                    else "",
                    updated_at=row["updated_at"].isoformat()
                    if row.get("updated_at")
                    else "",
                    base_url=row.get("base_url", ""),
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

            # Parse facet options from first row
            if not provider_options and row.get("provider_options"):
                opts = row["provider_options"]
                if isinstance(opts, str):
                    opts = json.loads(opts)
                if isinstance(opts, list):
                    provider_options = opts

            if not status_options and row.get("status_options"):
                opts = row["status_options"]
                if isinstance(opts, str):
                    opts = json.loads(opts)
                if isinstance(opts, list):
                    status_options = opts

        response_data = ProvidersListResponse(
            providers=providers,
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
            route_path=request.url.path,
            operation="get_providers_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
