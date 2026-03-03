"""Documents SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    QGetDocumentsV4Item,
    SearchDocumentsApiRequest,
    SearchDocumentsApiResponse,
    SearchDocumentsSqlParams,
    SearchDocumentsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/documents/search_documents_complete.sql"

router = APIRouter()


async def search_documents_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    department_ids: list[UUID] | None = None,
    draft_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    upload_ids: list[UUID] | None = None,
    text_ids: list[UUID] | None = None,
    image_ids: list[UUID] | None = None,
    template: bool | None = None,
    bypass_cache: bool = False,
    *,
    document: bool = False,
    scenario: bool = False,
) -> list[QGetDocumentsV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "documents"]
    cache_key_val = cache_key(
        "/api/v5/resources/documents/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "department_ids": [str(id) for id in (department_ids or [])],
            "draft_id": str(draft_id) if draft_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "upload_ids": sorted(str(i) for i in (upload_ids or [])),
            "text_ids": sorted(str(i) for i in (text_ids or [])),
            "image_ids": sorted(str(i) for i in (image_ids or [])),
            "template": template,
            "document": document,
            "scenario": scenario,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetDocumentsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchDocumentsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        department_ids=department_ids or [],
        draft_id=draft_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        upload_ids=upload_ids or [],
        text_ids=text_ids or [],
        image_ids=image_ids or [],
        template=template,
        document=document,
        scenario=scenario,
    )
    result = cast(
        SearchDocumentsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetDocumentsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/documents/search",
    response_model=SearchDocumentsApiResponse,
)
async def search_documents(
    request: SearchDocumentsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchDocumentsApiResponse:
    tags = ["resources", "documents"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_documents_internal(
            conn,
            search=request.search,
            limit_count=request.limit_count,
            offset_count=request.offset_count,
            department_ids=request.department_ids,
            draft_id=request.draft_id,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            upload_ids=request.upload_ids,
            text_ids=request.text_ids,
            image_ids=request.image_ids,
            template=request.template,
            bypass_cache=bypass_cache,
            document=request.document or False,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchDocumentsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_documents",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
