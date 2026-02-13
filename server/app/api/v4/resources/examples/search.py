"""Examples SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetExamplesV4Item,
    SearchExamplesApiRequest,
    SearchExamplesApiResponse,
    SearchExamplesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/examples/search_examples_complete.sql"

router = APIRouter()


# Handcrafted params to match SQL signature with artifact boolean filters
class SearchExamplesParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    persona_id: UUID | None = None
    user_department_ids: list[UUID] = []
    draft_id: UUID | None = None
    suggest_source: str | None = "all"
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    persona: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.persona_id,
            self.user_department_ids,
            self.draft_id,
            self.suggest_source,
            self.exclude_ids,
            self.persona,
        )


async def search_examples_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    persona_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
    draft_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    persona: bool = False,
) -> list[QGetExamplesV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "examples"]
    cache_key_val = cache_key(
        "/api/v4/resources/examples/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "persona_id": str(persona_id) if persona_id else None,
            "user_department_ids": [str(id) for id in (user_department_ids or [])],
            "draft_id": str(draft_id) if draft_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "persona": persona,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetExamplesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchExamplesParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        persona_id=persona_id,
        user_department_ids=user_department_ids or [],
        draft_id=draft_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        persona=persona,
    )
    result = cast(
        SearchExamplesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetExamplesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/examples/search",
    response_model=SearchExamplesApiResponse,
)
async def search_examples(
    request: SearchExamplesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchExamplesApiResponse:
    tags = ["resources", "examples"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_examples_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.persona_id,
            request.user_department_ids,
            request.draft_id,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchExamplesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_examples",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
