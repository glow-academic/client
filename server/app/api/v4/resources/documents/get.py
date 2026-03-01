"""Documents GET endpoint - v4 API.

Provides get endpoint for fetching a single document by ID.
"""

from typing import Annotated, cast
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
    GetDocumentsSqlParams,
    GetDocumentsSqlRow,
    QGetDocumentResourceV4Item,
    QGetDocumentsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/documents/get_document_resource_data_complete.sql"
BATCH_SQL_PATH = "app/sql/v4/queries/resources/documents/get_documents_complete.sql"

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

    items = result.items if result and result.items else []
    item = items[0] if items else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["documents"],
    )

    return item


async def get_documents_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetDocumentsV4Item]:
    """Internal function for batch fetching documents by IDs.

    This is a simple fetch without active flag check, used by scenario GET.

    Args:
        conn: Database connection
        ids: List of document IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of document items (may be fewer than requested if some don't exist)
    """
    if not ids:
        return []

    tags = ["resources", "documents"]
    cache_key_val = cache_key(
        "/api/v4/resources/documents/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetDocumentsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetDocumentsSqlParams(p_ids=ids)
    result = cast(
        GetDocumentsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetDocumentsV4Item] = result.items if result and result.items else []

    # Cache result
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
