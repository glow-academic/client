"""Get endpoint for benchmark messages view (mv_benchmark_messages)."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.benchmark.messages.types import (
    BenchmarkMessageViewItem,
    GetBenchmarkMessagesRequest,
    GetBenchmarkMessagesResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_benchmark_messages_internal(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    chat_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[BenchmarkMessageViewItem]:
    """Internal function for reading benchmark message rows."""
    cache_key_val = cache_key(
        "views/benchmark/messages/get",
        {
            "test_id": str(test_id) if test_id else None,
            "chat_id": str(chat_id) if chat_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                BenchmarkMessageViewItem.model_validate(item)
                for item in cached["items"]
            ]

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if test_id:
        conditions.append(f"test_id = ${param_idx}")
        params.append(test_id)
        param_idx += 1

    if chat_id:
        conditions.append(f"chat_id = ${param_idx}")
        params.append(chat_id)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    rows = await conn.fetch(
        f"""
        SELECT *
        FROM mv_benchmark_messages
        WHERE {where_clause}
        ORDER BY created_at ASC
        """,
        *params,
    )

    items = [
        BenchmarkMessageViewItem(
            message_id=row["message_id"],
            chat_id=row["chat_id"],
            test_id=row["test_id"],
            eval_id=row["eval_id"],
            run_id=row["run_id"],
            type=row["type"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            completed=row["completed"] or False,
        )
        for row in rows
    ]

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "benchmark", "messages"],
    )

    return items


@router.post(
    "/get",
    response_model=GetBenchmarkMessagesResponse,
    dependencies=[
        audit_activity(
            "views.benchmark.messages.get",
            "{{ actor.name }} fetched benchmark messages view data",
        )
    ],
)
async def get_benchmark_messages(
    request: GetBenchmarkMessagesRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkMessagesResponse:
    """Get benchmark message rows from mv_benchmark_messages."""
    tags = ["views", "benchmark", "messages"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_benchmark_messages_internal(
            conn=conn,
            test_id=request.test_id,
            chat_id=request.chat_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetBenchmarkMessagesResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_benchmark_messages_get",
            request=http_request,
        )
