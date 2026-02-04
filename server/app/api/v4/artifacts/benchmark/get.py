"""Get endpoint for benchmark artifact."""

import asyncio
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.benchmark.types import (
    BenchmarkRequest,
    BenchmarkResponse,
    BenchmarkViews,
    BenchmarkResources,
)
from app.api.v4.views.benchmark.attempt_facts.get import get_benchmark_attempt_facts_internal
from app.api.v4.views.benchmark.eval_summary.get import get_benchmark_eval_summary_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/get",
    response_model=BenchmarkResponse,
    dependencies=[
        audit_activity(
            "artifacts.benchmark.get",
            "{{ actor.name }} fetched benchmark artifact data",
        )
    ],
)
async def get_benchmark(
    request: BenchmarkRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BenchmarkResponse:
    """Get benchmark artifact data."""
    tags = ["artifacts", "benchmark"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:
        async def fetch_attempt_facts():
            async with pool.acquire() as c:
                return await get_benchmark_attempt_facts_internal(
                    conn=c,
                    eval_id=request.eval_id,
                    rubric_id=request.rubric_id,
                    status=request.status,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        async def fetch_eval_summary():
            async with pool.acquire() as c:
                return await get_benchmark_eval_summary_internal(
                    conn=c,
                    rubric_id=request.rubric_id,
                    status=request.status,
                    page_limit=request.page_limit,
                    bypass_cache=bypass_cache,
                )

        attempt_facts_result, eval_summary_result = await asyncio.gather(
            fetch_attempt_facts(),
            fetch_eval_summary(),
        )

        eval_ids: set[str] = set()
        rubric_ids: set[str] = set()

        for item in attempt_facts_result.items:
            if item.eval_id:
                eval_ids.add(str(item.eval_id))
            if item.rubric_id:
                rubric_ids.add(str(item.rubric_id))

        for item in eval_summary_result.items:
            if item.eval_id:
                eval_ids.add(str(item.eval_id))
            if item.rubric_id:
                rubric_ids.add(str(item.rubric_id))

        views = BenchmarkViews(
            attempt_facts=attempt_facts_result.items,
            eval_summary=eval_summary_result.items,
        )
        resources = BenchmarkResources(
            evals={eid: {} for eid in eval_ids},
            rubrics={rid: {} for rid in rubric_ids},
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return BenchmarkResponse(
            views=views,
            resources=resources,
            total_count=attempt_facts_result.total_count,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_benchmark_get",
            request=http_request,
        )
