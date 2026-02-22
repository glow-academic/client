"""Get endpoint for benchmark artifact."""

import asyncio
from collections import Counter
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
from app.api.v4.artifacts.test.permissions import compute_test_status
from app.api.v4.artifacts.types import (
    FilterOption,
    TestHistoryItem,
    TestHistoryResponse,
)
from app.api.v4.entries.tests.get import get_test_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.evals.get import get_evals_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import QGetTestViewV4Item

router = APIRouter()


async def _fetch_test_history_data(
    pool: asyncpg.Pool,
    request: BenchmarkRequest,
    department_uuids: list[UUID] | None,
    date_from: datetime | None,
    date_to: datetime | None,
    bypass_cache: bool,
) -> TestHistoryResponse:
    """Fetch paginated test history with hydrated names — adapted from test/list.py."""
    page_limit = request.history_page_size
    page_offset = request.history_page * request.history_page_size

    eval_uuids = (
        [UUID(e) for e in request.history_eval_ids]
        if request.history_eval_ids
        else None
    )

    async with pool.acquire() as c:
        result = await get_test_internal(
            conn=c,
            eval_ids=eval_uuids,
            department_ids=department_uuids,
            date_from=date_from,
            date_to=date_to,
            archived=request.history_archived,
            search=request.history_search,
            sort_by=request.history_sort_by,
            sort_order=request.history_sort_order,
            page_limit=page_limit,
            page_offset=page_offset,
            bypass_cache=bypass_cache,
        )

    # Collect IDs for hydration
    eval_name_ids: set[UUID] = set()
    eval_description_ids: set[UUID] = set()
    rubric_ids: set[UUID] = set()

    for row in result.items:
        if row.eval_name_id:
            eval_name_ids.add(row.eval_name_id)
        if row.eval_description_id:
            eval_description_ids.add(row.eval_description_id)
        if row.rubric_id:
            rubric_ids.add(row.rubric_id)

    # Batch resolve names, descriptions, rubrics
    async with pool.acquire() as c:
        eval_names = await get_names_internal(
            c, list(eval_name_ids), bypass_cache=bypass_cache
        )
        eval_descriptions = await get_descriptions_internal(
            c, list(eval_description_ids), bypass_cache=bypass_cache
        )
        rubrics = await get_rubrics_batch_internal(
            c, list(rubric_ids), bypass_cache=bypass_cache
        )

    # Build lookup maps
    name_map: dict[UUID, str] = {}
    for n in eval_names:
        if n.id and n.name:
            name_map[n.id] = n.name

    desc_map: dict[UUID, str] = {}
    for d in eval_descriptions:
        if d.id and d.description:
            desc_map[d.id] = d.description

    rubric_name_map: dict[UUID, str] = {}
    for r in rubrics:
        if r.rubric_id and r.name:
            rubric_name_map[r.rubric_id] = r.name

    # Build enriched items
    items: list[TestHistoryItem] = []
    eval_counter: Counter[str] = Counter()
    eval_id_to_name: dict[str, str | None] = {}

    for row in result.items:
        eval_name = name_map.get(row.eval_name_id) if row.eval_name_id else None
        eval_desc = (
            desc_map.get(row.eval_description_id) if row.eval_description_id else None
        )
        rubric_name = rubric_name_map.get(row.rubric_id) if row.rubric_id else None

        total_runs = row.num_chats
        completed_runs = row.num_chats_completed
        pending_runs = total_runs - completed_runs

        if row.eval_id:
            eid = str(row.eval_id)
            eval_counter[eid] += 1
            if eid not in eval_id_to_name:
                eval_id_to_name[eid] = eval_name

        items.append(
            TestHistoryItem(
                attempt_id=str(row.test_id),
                eval_id=str(row.eval_id) if row.eval_id else None,
                eval_name=eval_name,
                eval_description=eval_desc,
                rubric_id=str(row.rubric_id) if row.rubric_id else None,
                rubric_name=rubric_name,
                created_at=(
                    row.test_created_at.isoformat() if row.test_created_at else None
                ),
                archived=row.archived,
                status=compute_test_status(row.num_chats, row.num_chats_completed),
                total_runs=total_runs,
                completed_runs=completed_runs,
                pending_runs=pending_runs,
            )
        )

    # Build eval_options with name labels
    eval_options = [
        FilterOption(
            value=eval_id,
            label=eval_id_to_name.get(eval_id),
            count=count,
        )
        for eval_id, count in eval_counter.items()
    ]
    eval_options.sort(key=lambda option: option.value)

    return TestHistoryResponse(
        data=items,
        total_count=result.total_count,
        page=request.history_page,
        page_size=request.history_page_size,
        eval_options=eval_options,
    )


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

        # Step 1: Fetch tests from MV + date range + optional history in parallel
        async def fetch_tests():
            async with pool.acquire() as c:
                return await get_test_internal(
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
                    FROM test_mv
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

        # Build parallel tasks
        parallel_tasks: list = [
            fetch_tests(),
            fetch_benchmark_date_range(),
            _fetch_test_history_data(
                pool=pool,
                request=request,
                department_uuids=department_uuids,
                date_from=date_from,
                date_to=date_to,
                bypass_cache=bypass_cache,
            ),
        ]

        parallel_results = await asyncio.gather(*parallel_tasks)
        tests_result = parallel_results[0]
        benchmark_date_range = parallel_results[1]
        history_data: TestHistoryResponse | None = parallel_results[2]

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
                        [str(d) for d in ev.department_ids] if ev.department_ids else []
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
        tests: list[QGetTestViewV4Item] = tests_result.items

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return BenchmarkResponse(
            tests=tests,
            total_count=tests_result.total_count,
            evals=evals,
            departments=department_items,
            department_options=department_options,
            date_range_earliest=benchmark_date_range[0],
            date_range_latest=benchmark_date_range[1],
            history=history_data,
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
