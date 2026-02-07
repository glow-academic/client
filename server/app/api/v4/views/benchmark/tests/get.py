"""Get endpoint for benchmark tests view (mv_benchmark_tests)."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.benchmark.tests.types import (
    BenchmarkTestViewItem,
    GetBenchmarkTestsRequest,
    GetBenchmarkTestsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_benchmark_tests_internal(
    conn: asyncpg.Connection,
    test_ids: list[UUID] | None = None,
    eval_id: UUID | None = None,
    eval_ids: list[UUID] | None = None,
    profile_id: UUID | None = None,
    archived: bool | None = None,
    department_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetBenchmarkTestsResponse:
    """Internal function for reading benchmark tests rows."""
    normalized_test_ids = test_ids or []
    cache_key_val = cache_key(
        "views/benchmark/tests/get",
        {
            "test_ids": [str(t) for t in normalized_test_ids],
            "eval_id": str(eval_id) if eval_id else None,
            "eval_ids": [str(e) for e in eval_ids] if eval_ids else None,
            "profile_id": str(profile_id) if profile_id else None,
            "archived": archived,
            "department_ids": [str(d) for d in department_ids] if department_ids else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "search": search,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetBenchmarkTestsResponse.model_validate(cached)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if normalized_test_ids:
        conditions.append(f"test_id = ANY(${param_idx}::uuid[])")
        params.append(normalized_test_ids)
        param_idx += 1

    if eval_id:
        conditions.append(f"eval_id = ${param_idx}")
        params.append(eval_id)
        param_idx += 1

    if eval_ids:
        conditions.append(f"eval_id = ANY(${param_idx}::uuid[])")
        params.append(eval_ids)
        param_idx += 1

    if profile_id:
        conditions.append(f"profile_id = ${param_idx}")
        params.append(profile_id)
        param_idx += 1

    if archived is not None:
        conditions.append(f"archived = ${param_idx}")
        params.append(archived)
        param_idx += 1

    if department_ids:
        conditions.append(f"(department_ids && ${param_idx}::uuid[] OR department_ids = '{{}}')")
        params.append(department_ids)
        param_idx += 1

    if date_from:
        conditions.append(f"test_created_at >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"test_created_at < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    if search:
        conditions.append(
            f"eval_name_id IN (SELECT id FROM names_resource WHERE name ILIKE ${param_idx})"
        )
        params.append(f"%{search}%")
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    sort_column = {
        "date": "test_created_at",
        "updated": "test_updated_at",
    }.get(sort_by, "test_created_at")
    order_dir = "DESC" if sort_order == "desc" else "ASC"

    total_count = await conn.fetchval(
        f"SELECT COUNT(*) FROM mv_benchmark_tests WHERE {where_clause}", *params
    )

    data_query = f"""
        SELECT *
        FROM mv_benchmark_tests
        WHERE {where_clause}
        ORDER BY {sort_column} {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])
    rows = await conn.fetch(data_query, *params)

    items = [
        BenchmarkTestViewItem(
            test_id=row["test_id"],
            eval_id=row["eval_id"],
            profile_id=row["profile_id"],
            department_ids=row["department_ids"] or [],
            infinite_mode=row["infinite_mode"] or False,
            archived=row["archived"] or False,
            test_created_at=row["test_created_at"],
            test_updated_at=row["test_updated_at"],
            num_chats=row["num_chats"] or 0,
            num_chats_completed=row["num_chats_completed"] or 0,
            num_messages=row["num_messages"] or 0,
            eval_name_id=row["eval_name_id"],
            eval_description_id=row["eval_description_id"],
            rubric_id=row["rubric_id"],
        )
        for row in rows
    ]

    response = GetBenchmarkTestsResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "benchmark", "tests"],
    )

    return response


@router.post(
    "/get",
    response_model=GetBenchmarkTestsResponse,
    dependencies=[
        audit_activity(
            "views.benchmark.tests.get",
            "{{ actor.name }} fetched benchmark tests view data",
        )
    ],
)
async def get_benchmark_tests(
    request: GetBenchmarkTestsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkTestsResponse:
    """Get benchmark tests view rows from mv_benchmark_tests."""
    tags = ["views", "benchmark", "tests"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_benchmark_tests_internal(
            conn=conn,
            test_ids=request.test_ids,
            eval_id=request.eval_id,
            profile_id=request.profile_id,
            archived=request.archived,
            date_from=request.date_from,
            date_to=request.date_to,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
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
            operation="views_benchmark_tests_get",
            request=http_request,
        )
