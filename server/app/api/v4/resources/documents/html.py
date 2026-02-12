"""Documents HTML endpoint - v4 API.

Provides endpoint for fetching document HTML content by ID.
Replaces the old templates/html endpoint after template->document consolidation.
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

SQL_PATH = "app/sql/v4/queries/documents/get_document_html_data_complete.sql"

router = APIRouter()


# =============================================================================
# Types
# =============================================================================


class GetDocumentHtmlApiRequest(BaseModel):
    """Request for getting document HTML by ID."""

    id: UUID


class GetDocumentHtmlApiResponse(BaseModel):
    """Response for getting document HTML."""

    html: str | None = None


class GetDocumentHtmlSqlParams(BaseModel):
    """SQL parameters for get document HTML."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetDocumentHtmlSqlRow(BaseModel):
    """SQL row for get document HTML."""

    html: str | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_document_html_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> str | None:
    """Internal function for fetching document HTML."""
    cache_key_val = cache_key("documents/html", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return cached.get("html")

    params = GetDocumentHtmlSqlParams(id=id)
    result = cast(
        GetDocumentHtmlSqlRow | None,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    html = result.html if result else None

    await set_cached(
        cache_key_val,
        {"html": html},
        ttl=60,
        tags=["documents"],
    )

    return html


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/documents/html",
    response_model=GetDocumentHtmlApiResponse,
)
async def get_document_html(
    request: GetDocumentHtmlApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDocumentHtmlApiResponse:
    """Get document HTML by ID."""
    tags = ["resources", "documents"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        html = await get_document_html_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetDocumentHtmlApiResponse(html=html)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_document_html",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
