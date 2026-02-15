"""Get endpoint for text list view."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.text.list.types import (
    GetTextListViewResponse,
    TextViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/text/list/get_text_list_view_complete.sql"

router = APIRouter()


async def get_text_list_view_internal(
    conn: asyncpg.Connection,
    texts_id_filter: UUID | None = None,
    content_hash_filter: str | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetTextListViewResponse:
    """Internal function for fetching text data from mv_texts."""
    from app.sql.types import GetTextListViewSqlParams

    cache_key_val = cache_key(
        "views/text/list/get",
        {
            "texts_id_filter": str(texts_id_filter) if texts_id_filter else None,
            "content_hash_filter": content_hash_filter,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetTextListViewResponse.model_validate(cached)

    params = GetTextListViewSqlParams(
        texts_id_filter=texts_id_filter,
        content_hash_filter=content_hash_filter,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[TextViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                TextViewItem(
                    texts_id=item.texts_id,
                    text_id=item.text_id,
                    content=item.content,
                    content_hash=item.content_hash,
                    created_at=item.created_at,
                )
            )

    response = GetTextListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "text", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetTextListViewResponse,
    dependencies=[
        audit_activity(
            "views.text.list.get",
            "{{ actor.name }} fetched text list data",
        )
    ],
)
async def get_texts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTextListViewResponse:
    """Get text data from the materialized view."""
    tags = ["views", "text", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_text_list_view_internal(
            conn=conn,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_text_list_get",
            request=http_request,
        )
