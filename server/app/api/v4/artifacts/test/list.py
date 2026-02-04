"""Benchmark test artifact list endpoint."""

from collections import Counter
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.api.v4.artifacts.test.permissions import compute_test_status
from app.api.v4.artifacts.test.types import (
    GetTestListRequest,
    GetTestListResponse,
    TestListFilterOption,
    TestListItem,
)
from app.api.v4.views.benchmark.tests.get import get_benchmark_tests_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


@router.post(
    "/list",
    response_model=GetTestListResponse,
    dependencies=[
        audit_activity(
            "artifacts.test.list",
            "{{ actor.name }} fetched test artifact list",
        )
    ],
)
async def list_test_artifacts(
    request: GetTestListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestListResponse:
    """List benchmark tests with minimal filter metadata."""
    tags = ["artifacts", "test"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_benchmark_tests_internal(
            conn=conn,
            eval_id=request.eval_id,
            archived=request.archived,
            date_from=request.date_from,
            date_to=request.date_to,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            bypass_cache=bypass_cache,
        )

        items: list[TestListItem] = []
        eval_counter: Counter[str] = Counter()

        for row in result.items:
            if row.eval_id:
                eval_counter[str(row.eval_id)] += 1

            items.append(
                TestListItem(
                    test_id=row.test_id,
                    eval_id=row.eval_id,
                    profile_id=row.profile_id,
                    archived=row.archived,
                    created_at=row.test_created_at,
                    num_chats=row.num_chats,
                    num_chats_completed=row.num_chats_completed,
                    num_messages=row.num_messages,
                    status=compute_test_status(row.num_chats, row.num_chats_completed),
                )
            )

        eval_options = [
            TestListFilterOption(value=eval_id, label=eval_id, count=count)
            for eval_id, count in eval_counter.items()
        ]
        eval_options.sort(key=lambda option: option.value)

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestListResponse(
            data=items,
            total_count=result.total_count,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            eval_options=eval_options,
        )
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_test_list",
            request=http_request,
        )
