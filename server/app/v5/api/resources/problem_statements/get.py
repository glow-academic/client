"""Problem Statements GET endpoint - v4 API.

Provides get endpoint for fetching a single problem statement by ID.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.resources.problem_statements.types import (
    GetProblemStatementApiRequest,
    GetProblemStatementApiResponse,
    GetProblemStatementSqlParams,
    GetProblemStatementSqlRow,
    GetProblemStatementV4Item,
)
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    GetProblemStatementsSqlParams,
    GetProblemStatementsSqlRow,
    QGetProblemStatementsV4Item,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/v5/sql/queries/resources/problem_statements/get_problem_statement_complete.sql"
)
BATCH_SQL_PATH = "app/v5/sql/queries/resources/problem_statements/get_problem_statements_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_problem_statement_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> GetProblemStatementV4Item | None:
    """Internal function for fetching a single problem statement."""
    cache_key_val = cache_key("problem_statements/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return GetProblemStatementV4Item.model_validate(item_data)
            return None

    params = GetProblemStatementSqlParams(id=id)
    result = cast(
        GetProblemStatementSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items if result and result.items else []
    item = items[0] if items else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["problem_statements"],
    )

    return item


async def get_problem_statements_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetProblemStatementsV4Item]:
    """Internal function for batch fetching problem statements by IDs.

    This is a simple fetch without active flag check, used by scenario GET.
    """
    if not ids:
        return []

    tags = ["resources", "problem_statements"]
    cache_key_val = cache_key(
        "/api/v5/resources/problem_statements/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetProblemStatementsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetProblemStatementsSqlParams(p_ids=ids)
    result = cast(
        GetProblemStatementsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetProblemStatementsV4Item] = (
        result.items if result and result.items else []
    )

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
    "/problem_statements/get",
    response_model=GetProblemStatementApiResponse,
)
async def get_problem_statement(
    request: GetProblemStatementApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProblemStatementApiResponse:
    """Get problem statement by ID."""
    tags = ["resources", "problem_statements"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_problem_statement_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProblemStatementApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_problem_statement",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
