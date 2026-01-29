"""Templates GET endpoint - v4 API.

Provides get endpoint for fetching a single template by ID.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetTemplatesSqlParams,
    GetTemplatesSqlRow,
    QGetTemplatesV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/templates/get_template_complete.sql"
BATCH_SQL_PATH = "app/sql/v4/queries/resources/templates/get_templates_complete.sql"

router = APIRouter()


# =============================================================================
# Types
# =============================================================================


class GetTemplateV4Item(BaseModel):
    """Template item returned from get endpoint."""

    template_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    html: str | None = None
    generated: bool | None = None


class GetTemplateApiRequest(BaseModel):
    """Request for getting a template by ID."""

    id: UUID


class GetTemplateApiResponse(BaseModel):
    """Response for getting a template."""

    item: GetTemplateV4Item | None = None


class GetTemplateSqlParams(BaseModel):
    """SQL parameters for get template."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetTemplateSqlRow(BaseModel):
    """SQL row for get template."""

    item: GetTemplateV4Item | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_template_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> GetTemplateV4Item | None:
    """Internal function for fetching a single template."""
    cache_key_val = cache_key("templates/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return GetTemplateV4Item.model_validate(item_data)
            return None

    params = GetTemplateSqlParams(id=id)
    result = cast(
        GetTemplateSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    item = result.item if result else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["templates"],
    )

    return item


async def get_templates_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetTemplatesV4Item]:
    """Internal function for batch fetching templates by IDs.

    This is a simple fetch without active flag check, used by scenario GET.
    """
    if not ids:
        return []

    tags = ["resources", "templates"]
    cache_key_val = cache_key(
        "/api/v4/resources/templates/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [QGetTemplatesV4Item.model_validate(item) for item in cached.get("items", [])]

    params = GetTemplatesSqlParams(p_ids=ids)
    result = cast(
        GetTemplatesSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetTemplatesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/templates/get",
    response_model=GetTemplateApiResponse,
)
async def get_template(
    request: GetTemplateApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTemplateApiResponse:
    """Get template by ID."""
    tags = ["resources", "templates"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_template_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTemplateApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_template",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
