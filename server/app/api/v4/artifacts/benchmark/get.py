"""Get endpoint for benchmark artifact."""

import asyncio
from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.benchmark.types import (
    BenchmarkDepartmentItem,
    BenchmarkEvalItem,
    BenchmarkRequest,
    BenchmarkResponse,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.evals.get import get_evals_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.views.benchmark.tests.get import get_benchmark_tests_internal
from app.api.v4.views.benchmark.tests.types import BenchmarkTestViewItem
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
    """Get benchmark artifact data with full resource hydration."""
    tags = ["artifacts", "benchmark"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:
        # Convert string department_ids to UUIDs for filtering
        department_uuids = (
            [UUID(d) for d in request.department_ids]
            if request.department_ids
            else None
        )

        # Parse date strings to datetime
        date_from: datetime | None = None
        date_to: datetime | None = None
        if request.start_date:
            date_from = datetime.fromisoformat(request.start_date)
        if request.end_date:
            date_to = datetime.fromisoformat(request.end_date)

        # Step 1: Fetch tests from MV + date range in parallel
        async def fetch_tests():
            async with pool.acquire() as c:
                return await get_benchmark_tests_internal(
                    conn=c,
                    department_ids=department_uuids,
                    date_from=date_from,
                    date_to=date_to,
                    page_limit=200,
                    bypass_cache=bypass_cache,
                )

        async def fetch_benchmark_date_range() -> tuple[str | None, str | None]:
            async with pool.acquire() as c:
                conditions: list[str] = []
                params: list = []
                idx = 1
                if department_uuids:
                    conditions.append(f"department_ids && ${idx}::uuid[]")
                    params.append(department_uuids)
                    idx += 1
                if date_from:
                    conditions.append(f"created_at >= ${idx}")
                    params.append(date_from)
                    idx += 1
                if date_to:
                    conditions.append(f"created_at < ${idx}")
                    params.append(date_to)
                    idx += 1
                where = " AND ".join(conditions) if conditions else "TRUE"
                row = await c.fetchrow(
                    f"""
                    SELECT MIN(created_at) as earliest, MAX(created_at) as latest
                    FROM mv_benchmark_tests
                    WHERE {where}
                    """,
                    *params,
                )
                if row and row["earliest"]:
                    return (
                        row["earliest"].isoformat(),
                        row["latest"].isoformat(),
                    )
                return (None, None)

        tests_result, benchmark_date_range = await asyncio.gather(
            fetch_tests(),
            fetch_benchmark_date_range(),
        )

        # Step 2: Collect unique IDs from tests
        eval_ids: set[UUID] = set()
        all_department_ids: set[UUID] = set()

        for item in tests_result.items:
            if item.eval_id:
                eval_ids.add(item.eval_id)
            if item.department_ids:
                all_department_ids.update(item.department_ids)

        # Step 3: Batch resolve evals and departments
        async def fetch_evals():
            async with pool.acquire() as c:
                return await get_evals_internal(
                    c, list(eval_ids), bypass_cache=bypass_cache
                )

        async def fetch_departments():
            async with pool.acquire() as c:
                return await get_departments_internal(
                    c, list(all_department_ids), bypass_cache=bypass_cache
                )

        evals_list, departments = await asyncio.gather(
            fetch_evals(),
            fetch_departments(),
        )

        # Step 4: Build eval items from eval resource
        evals: list[BenchmarkEvalItem] = []
        for ev in evals_list:
            evals.append(
                BenchmarkEvalItem(
                    eval_id=str(ev.id),
                    name=ev.name,
                    description=ev.description,
                    department_ids=(
                        [str(d) for d in ev.department_ids]
                        if ev.department_ids
                        else []
                    ),
                )
            )

        # Step 5: Build department items
        department_items = [
            BenchmarkDepartmentItem(
                department_id=str(d.department_id),
                name=d.name,
                description=d.description,
            )
            for d in departments
            if d.department_id
        ]

        # Step 6: Build filter options
        department_options = [
            FilterOption(value=str(d.department_id), label=d.name)
            for d in departments
            if d.department_id
        ]

        # Build test items for response
        tests: list[BenchmarkTestViewItem] = tests_result.items

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return BenchmarkResponse(
            tests=tests,
            total_count=tests_result.total_count,
            evals=evals,
            departments=department_items,
            department_options=department_options,
            date_range_earliest=benchmark_date_range[0],
            date_range_latest=benchmark_date_range[1],
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
