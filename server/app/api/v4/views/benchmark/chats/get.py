"""Get endpoint for benchmark chats view (mv_benchmark_chats)."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.benchmark.chats.types import (
    BenchmarkChatViewItem,
    GetBenchmarkChatsRequest,
    GetBenchmarkChatsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_benchmark_chats_internal(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    chat_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[BenchmarkChatViewItem]:
    """Internal function for reading benchmark chat rows."""
    normalized_chat_ids = chat_ids or []
    cache_key_val = cache_key(
        "views/benchmark/chats/get",
        {
            "test_id": str(test_id) if test_id else None,
            "chat_ids": [str(c) for c in normalized_chat_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [BenchmarkChatViewItem.model_validate(item) for item in cached["items"]]

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if test_id:
        conditions.append(f"test_id = ${param_idx}")
        params.append(test_id)
        param_idx += 1

    if normalized_chat_ids:
        conditions.append(f"chat_id = ANY(${param_idx}::uuid[])")
        params.append(normalized_chat_ids)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    rows = await conn.fetch(
        f"""
        SELECT *
        FROM mv_benchmark_chats
        WHERE {where_clause}
        ORDER BY chat_created_at ASC
        """,
        *params,
    )

    items = [
        BenchmarkChatViewItem(
            chat_id=row["chat_id"],
            test_id=row["test_id"],
            eval_id=row["eval_id"],
            run_ids=row["run_ids"] or [],
            group_ids=row["group_ids"] or [],
            chat_created_at=row["chat_created_at"],
            chat_updated_at=row["chat_updated_at"],
            chat_title=row["chat_title"],
            chat_completed=row["chat_completed"] or False,
            grade_score=row["grade_score"],
            grade_passed=row["grade_passed"],
            grade_time_taken=row["grade_time_taken"],
            num_messages=row["num_messages"] or 0,
        )
        for row in rows
    ]

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "benchmark", "chats"],
    )

    return items


@router.post(
    "/get",
    response_model=GetBenchmarkChatsResponse,
    dependencies=[
        audit_activity(
            "views.benchmark.chats.get",
            "{{ actor.name }} fetched benchmark chats view data",
        )
    ],
)
async def get_benchmark_chats(
    request: GetBenchmarkChatsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkChatsResponse:
    """Get benchmark chat rows from mv_benchmark_chats."""
    tags = ["views", "benchmark", "chats"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_benchmark_chats_internal(
            conn=conn,
            test_id=request.test_id,
            chat_ids=request.chat_ids,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetBenchmarkChatsResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_benchmark_chats_get",
            request=http_request,
        )
