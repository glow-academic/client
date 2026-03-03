"""Get endpoint for benchmark artifact.

Pulls from benchmark_mv (eval cards) and test_mv (test history).
Follows the home/get.py pattern: parallel fetch → collect IDs → batch hydrate.
"""

import asyncio
from collections import Counter
from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.benchmark.types import (
    BenchmarkDepartmentItem,
    BenchmarkEvalCard,
    BenchmarkRequest,
    BenchmarkResponse,
)
from app.routes.v5.api.main.test.permissions import compute_test_status
from app.routes.v5.api.main.types import (
    FilterOption,
    TestHistoryItem,
    TestHistoryResponse,
)
from app.routes.v5.api.entries.test.search import get_test_list_internal
from app.routes.v5.api.resources.departments.get import get_departments_internal
from app.routes.v5.api.resources.evals.get import get_evals_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import QGetTestListViewV4Item

router = APIRouter()


# =============================================================================
# Helpers
# =============================================================================


async def _fetch_benchmark_entries(
    pool: asyncpg.Pool,
    department_ids: list[UUID] | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[dict]:
    """Fetch benchmark entries from benchmark_mv with optional filters."""
    conditions: list[str] = []
    params: list = []
    idx = 1

    if department_ids:
        conditions.append(f"bm.department_ids && ${idx}::uuid[]")
        params.append(department_ids)
        idx += 1

    if date_from:
        conditions.append(f"bm.created_at >= ${idx}")
        params.append(date_from)
        idx += 1

    if date_to:
        conditions.append(f"bm.created_at < ${idx}")
        params.append(date_to)
        idx += 1

    where = " AND ".join(conditions) if conditions else "TRUE"

    async with pool.acquire() as c:
        rows = await c.fetch(
            f"""
            SELECT
                bm.benchmark_id,
                bm.eval_ids,
                bm.profile_ids,
                bm.department_ids,
                bm.invocation_entry_ids,
                bm.use_groups,
                bm.dynamic,
                bm.created_at
            FROM benchmark_mv bm
            WHERE {where}
            ORDER BY bm.created_at DESC
            """,
            *params,
        )

    return [dict(r) for r in rows]


def _build_eval_cards(
    benchmark_entries: list[dict],
    test_items: list[QGetTestListViewV4Item],
    evals_list: list,
) -> list[BenchmarkEvalCard]:
    """Build eval cards with aggregated test stats."""
    # Count tests per eval
    tests_per_eval: Counter[UUID] = Counter()
    archived_per_eval: Counter[UUID] = Counter()
    for t in test_items:
        if t.eval_id:
            tests_per_eval[t.eval_id] += 1
            if t.archived:
                archived_per_eval[t.eval_id] += 1

    # Collect department_ids per eval from benchmark entries
    dept_ids_per_eval: dict[UUID, set[str]] = {}
    for be in benchmark_entries:
        for eid in be.get("eval_ids") or []:
            if eid not in dept_ids_per_eval:
                dept_ids_per_eval[eid] = set()
            for did in be.get("department_ids") or []:
                dept_ids_per_eval[eid].add(str(did))

    # Build cards from hydrated evals
    cards: list[BenchmarkEvalCard] = []
    for ev in evals_list:
        if not ev.id:
            continue
        eid = ev.id
        cards.append(
            BenchmarkEvalCard(
                eval_id=str(eid),
                name=ev.name,
                description=ev.description,
                department_ids=sorted(dept_ids_per_eval.get(eid, set())),
                total_tests=tests_per_eval.get(eid, 0),
                archived_tests=archived_per_eval.get(eid, 0),
            )
        )

    return cards


async def _fetch_test_history(
    conn: asyncpg.Connection,
    request: BenchmarkRequest,
    department_ids: list[UUID] | None,
    date_from: datetime | None,
    date_to: datetime | None,
    bypass_cache: bool,
) -> TestHistoryResponse:
    """Fetch paginated test history with hydrated names."""
    eval_uuids = (
        [UUID(e) for e in request.history_eval_ids]
        if request.history_eval_ids
        else None
    )

    result = await get_test_list_internal(
        conn,
        department_ids=department_ids,
        eval_ids=eval_uuids,
        is_archived_filter=request.history_archived,
        date_from=date_from,
        date_to=date_to,
        search_text=request.history_search,
        sort_by=request.history_sort_by,
        sort_order=request.history_sort_order,
        page_limit=request.history_page_size,
        page_offset=request.history_page * request.history_page_size,
        bypass_cache=bypass_cache,
    )

    items_list = result.items or []

    # Collect IDs for hydration
    eval_ids_set: set[UUID] = set()
    for item in items_list:
        if item.eval_id:
            eval_ids_set.add(item.eval_id)

    # Batch resolve names via evals resource
    evals = await get_evals_internal(
        conn, list(eval_ids_set), bypass_cache=bypass_cache
    )

    eval_name_map: dict[UUID, str | None] = {}
    eval_desc_map: dict[UUID, str | None] = {}
    for ev in evals:
        if ev.id:
            eval_name_map[ev.id] = ev.name
            eval_desc_map[ev.id] = ev.description

    # Build enriched items
    history_items: list[TestHistoryItem] = []
    eval_counter: Counter[str] = Counter()
    eval_id_to_name: dict[str, str | None] = {}

    for item in items_list:
        eval_name = eval_name_map.get(item.eval_id) if item.eval_id else None
        eval_desc = eval_desc_map.get(item.eval_id) if item.eval_id else None

        total_runs = item.num_invocations or 0
        completed_runs = item.num_invocations_completed or 0
        pending_runs = total_runs - completed_runs

        if item.eval_id:
            eid = str(item.eval_id)
            eval_counter[eid] += 1
            if eid not in eval_id_to_name:
                eval_id_to_name[eid] = eval_name

        history_items.append(
            TestHistoryItem(
                attempt_id=str(item.test_id),
                eval_id=str(item.eval_id) if item.eval_id else None,
                eval_name=eval_name,
                eval_description=eval_desc,
                created_at=(
                    item.test_created_at.isoformat() if item.test_created_at else None
                ),
                archived=item.archived or False,
                status=compute_test_status(total_runs, completed_runs),
                total_runs=total_runs,
                completed_runs=completed_runs,
                pending_runs=pending_runs,
            )
        )

    eval_options = [
        FilterOption(value=eval_id, label=eval_id_to_name.get(eval_id), count=count)
        for eval_id, count in eval_counter.items()
    ]
    eval_options.sort(key=lambda o: o.value)

    return TestHistoryResponse(
        data=history_items,
        total_count=result.total_count or 0,
        page=request.history_page,
        page_size=request.history_page_size,
        eval_options=eval_options,
    )


# =============================================================================
# HTTP endpoint
# =============================================================================


@router.post("/get", response_model=BenchmarkResponse)
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
        department_uuids = (
            [UUID(d) for d in request.department_ids]
            if request.department_ids
            else None
        )
        date_from: datetime | None = None
        date_to: datetime | None = None
        if request.start_date:
            date_from = datetime.fromisoformat(request.start_date)
        if request.end_date:
            date_to = datetime.fromisoformat(request.end_date)

        # --- Phase 1: Parallel fetches ---
        # Use entries-layer get_test_list_internal for test data (canonical pattern)
        async def fetch_all_tests():
            async with pool.acquire() as c:
                return await get_test_list_internal(
                    c,
                    department_ids=department_uuids,
                    date_from=date_from,
                    date_to=date_to,
                    page_limit=10000,
                    bypass_cache=bypass_cache,
                )

        async def fetch_history():
            async with pool.acquire() as c:
                return await _fetch_test_history(
                    c, request, department_uuids, date_from, date_to, bypass_cache
                )

        benchmark_entries, all_tests_result, history = await asyncio.gather(
            _fetch_benchmark_entries(pool, department_uuids, date_from, date_to),
            fetch_all_tests(),
            fetch_history(),
        )

        all_test_items = all_tests_result.items or []

        # --- Phase 2: Collect IDs for batch hydration ---
        eval_ids: set[UUID] = set()
        all_department_ids: set[UUID] = set()

        for be in benchmark_entries:
            for eid in be.get("eval_ids") or []:
                eval_ids.add(eid)
            for did in be.get("department_ids") or []:
                all_department_ids.add(did)

        # Also collect from tests (may have departments not on benchmarks)
        for t in all_test_items:
            if t.eval_id:
                eval_ids.add(t.eval_id)
            if t.department_ids:
                all_department_ids.update(t.department_ids)

        # --- Phase 3: Batch hydrate resources ---
        async def fetch_evals() -> list:
            async with pool.acquire() as c:
                return await get_evals_internal(
                    c, list(eval_ids), bypass_cache=bypass_cache
                )

        async def fetch_departments() -> list:
            async with pool.acquire() as c:
                return await get_departments_internal(
                    c, list(all_department_ids), bypass_cache=bypass_cache
                )

        evals_list, departments = await asyncio.gather(
            fetch_evals(),
            fetch_departments(),
        )

        # --- Phase 4: Build response ---
        # Derive date range from all_test_items instead of a separate query
        date_range_earliest: str | None = None
        date_range_latest: str | None = None
        if all_test_items:
            dates = [
                t.test_created_at
                for t in all_test_items
                if t.test_created_at is not None
            ]
            if dates:
                date_range_earliest = min(dates).isoformat()
                date_range_latest = max(dates).isoformat()

        eval_cards = _build_eval_cards(benchmark_entries, all_test_items, evals_list)

        department_items = [
            BenchmarkDepartmentItem(
                department_id=str(d.department_id),
                name=d.name,
                description=d.description,
            )
            for d in departments
            if d.department_id
        ]

        department_options = [
            FilterOption(value=str(d.department_id), label=d.name)
            for d in departments
            if d.department_id
        ]

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return BenchmarkResponse(
            evals=eval_cards,
            departments=department_items,
            department_options=department_options,
            date_range_earliest=date_range_earliest,
            date_range_latest=date_range_latest,
            history=history,
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
