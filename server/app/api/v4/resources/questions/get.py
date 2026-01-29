"""Questions GET endpoint - v4 API.

Provides get endpoint for fetching a single question by ID.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetQuestionsSqlParams,
    GetQuestionsSqlRow,
    QGetQuestionsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/questions/get_question_complete.sql"
BATCH_SQL_PATH = "app/sql/v4/queries/resources/questions/get_questions_complete.sql"

router = APIRouter()


# =============================================================================
# Types
# =============================================================================


class GetQuestionV4Item(BaseModel):
    """Question item returned from get endpoint."""

    question_id: UUID | None = None
    question_text: str | None = None
    allow_multiple: bool | None = None
    generated: bool | None = None


class GetQuestionApiRequest(BaseModel):
    """Request for getting a question by ID."""

    id: UUID


class GetQuestionApiResponse(BaseModel):
    """Response for getting a question."""

    item: GetQuestionV4Item | None = None


class GetQuestionSqlParams(BaseModel):
    """SQL parameters for get question."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetQuestionSqlRow(BaseModel):
    """SQL row for get question."""

    item: GetQuestionV4Item | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_question_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> GetQuestionV4Item | None:
    """Internal function for fetching a single question."""
    cache_key_val = cache_key("questions/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return GetQuestionV4Item.model_validate(item_data)
            return None

    params = GetQuestionSqlParams(id=id)
    result = cast(
        GetQuestionSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    item = result.item if result else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["questions"],
    )

    return item


async def get_questions_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetQuestionsV4Item]:
    """Internal function for batch fetching questions by IDs.

    This is a simple fetch without active flag check, used by scenario GET.
    """
    if not ids:
        return []

    tags = ["resources", "questions"]
    cache_key_val = cache_key(
        "/api/v4/resources/questions/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetQuestionsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetQuestionsSqlParams(p_ids=ids)
    result = cast(
        GetQuestionsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetQuestionsV4Item] = result.items if result and result.items else []

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
    "/questions/get",
    response_model=GetQuestionApiResponse,
)
async def get_question(
    request: GetQuestionApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetQuestionApiResponse:
    """Get question by ID."""
    tags = ["resources", "questions"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_question_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetQuestionApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_question",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
