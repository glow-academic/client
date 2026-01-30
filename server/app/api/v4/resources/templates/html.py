"""Templates HTML endpoint - v4 API.

Provides endpoint for fetching template HTML content by ID.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/templates/get_template_html_complete.sql"

router = APIRouter()


# =============================================================================
# Types
# =============================================================================


class GetTemplateHtmlApiRequest(BaseModel):
    """Request for getting template HTML by ID."""

    id: UUID


class GetTemplateHtmlApiResponse(BaseModel):
    """Response for getting template HTML."""

    html: str | None = None


class GetTemplateHtmlSqlParams(BaseModel):
    """SQL parameters for get template HTML."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetTemplateHtmlSqlRow(BaseModel):
    """SQL row for get template HTML."""

    html: str | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_template_html_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> str | None:
    """Internal function for fetching template HTML."""
    cache_key_val = cache_key("templates/html", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return cached.get("html")

    params = GetTemplateHtmlSqlParams(id=id)
    result = cast(
        GetTemplateHtmlSqlRow | None,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    html = result.html if result else None

    await set_cached(
        cache_key_val,
        {"html": html},
        ttl=60,
        tags=["templates"],
    )

    return html


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/templates/html",
    response_model=GetTemplateHtmlApiResponse,
)
async def get_template_html(
    request: GetTemplateHtmlApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTemplateHtmlApiResponse:
    """Get template HTML by ID."""
    tags = ["resources", "templates"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        html = await get_template_html_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTemplateHtmlApiResponse(html=html)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_template_html",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
