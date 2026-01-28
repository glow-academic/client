"""Documents GET endpoint - v4 API.

Provides get endpoint for fetching a single document by ID.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetDocumentResourceApiRequest,
    GetDocumentResourceApiResponse,
    GetDocumentResourceSqlParams,
    GetDocumentResourceSqlRow,
    QGetDocumentResourceV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/documents/get_document_resource_complete.sql"

router = APIRouter()


# =============================================================================
# Internal Function
# =============================================================================


async def get_document_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> QGetDocumentResourceV4Item | None:
    """Internal function for fetching a single document."""
    cache_key_val = cache_key("documents/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return QGetDocumentResourceV4Item.model_validate(item_data)
            return None

    params = GetDocumentResourceSqlParams(document_id=id)
    result = cast(
        GetDocumentResourceSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    item = result.item if result else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["documents"],
    )

    return item


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/documents/get",
    response_model=GetDocumentResourceApiResponse,
)
async def get_document(
    request: GetDocumentResourceApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDocumentResourceApiResponse:
    """Get document by ID."""
    tags = ["resources", "documents"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_document_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetDocumentResourceApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_document",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
