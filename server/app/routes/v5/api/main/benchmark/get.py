"""Get endpoint for benchmark artifact — composable infra pattern.

Cards for evals from benchmark_mv + invocation_mv + test_invocation_mv.
"""

import asyncio
from collections import Counter, defaultdict
from datetime import datetime
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Request, Response
from redis.asyncio import Redis

from app.infra.analytics_facets import (
    HIDDEN,
    VISIBLE,
    AnalyticsFacetsConfig,
    resolve_analytics_facets,
)
from app.infra.benchmark_context import (
    resolve_benchmark_context,
    resolve_benchmark_search_context,
)
from app.infra.benchmark_permissions import (
    compute_benchmark_eval_status,
)
from app.infra.common_context import resolve_common_context
from app.infra.globals import get_pool, get_redis_client
from app.infra.test_permissions import compute_test_status
from app.infra.types import ArtifactContext
from app.routes.auth.types import AnalyticsFilterFields
from app.routes.v5.api.main.benchmark.types import (
    BenchmarkDepartmentItem,
    BenchmarkEvalOperational,
    BenchmarkHistoryItem,
    BenchmarkHistoryResponse,
    BenchmarkRequest,
    BenchmarkResponse,
)
from app.routes.v5.api.main.types import FilterOption
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# ---------------------------------------------------------------------------
# Benchmark analytics facets config
# ---------------------------------------------------------------------------

BENCHMARK_FACETS_CONFIG = AnalyticsFacetsConfig(
    fields=AnalyticsFilterFields(
        date_range=VISIBLE,
        departments=VISIBLE,
        cohorts=HIDDEN,
        roles=HIDDEN,
        attempts=VISIBLE,
    ),
    mv_source="benchmark",
    attempt_options=["general", "archived"],
)


@router.post("/get", response_model=BenchmarkResponse)
async def get_benchmark(
    request: BenchmarkRequest,
    http_request: Request,
    response: Response,
) -> BenchmarkResponse:
    """Get benchmark artifact data with full resource hydration."""
    tags = ["artifacts", "benchmark"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

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

        # ── Phase 0: Resolve common context (profile identity) ────────
        async with pool.acquire() as c:
            common = await resolve_common_context(
                c, redis, profile_id=profile_id, bypass_cache=bypass_cache
            )
        if not common:
            raise HTTPException(status_code=401, detail="Profile not found")

        profile = common.profile

        # ── Resolve contexts + analytics facets in parallel ───────────
        (cards_ctx, history_ctx), analytics_facets = await asyncio.gather(
            _resolve_both(
                pool,
                redis,
                request=request,
                department_ids=department_uuids,
                date_from=date_from,
                date_to=date_to,
                bypass_cache=bypass_cache,
            ),
            resolve_analytics_facets(
                pool,
                redis,
                config=BENCHMARK_FACETS_CONFIG,
                profile=profile,
                bypass_cache=bypass_cache,
            ),
        )

        # ── Build eval cards from cards context ───────────────────────
        benchmarks = cards_ctx.entries.get("benchmarks", [])
        invocations = cards_ctx.entries.get("invocations", [])
        tests = cards_ctx.entries.get("tests", [])
        test_invocations = cards_ctx.entries.get("test_invocations", [])

        evals_list = (
            cards_ctx.resources["evals"].selected
            if "evals" in cards_ctx.resources
            else []
        )
        depts_list = (
            cards_ctx.resources["departments"].selected
            if "departments" in cards_ctx.resources
            else []
        )

        eval_cards = _build_eval_cards(
            benchmarks, invocations, tests, test_invocations, evals_list
        )

        # ── Build department items/options ────────────────────────────
        department_items = [
            BenchmarkDepartmentItem(
                department_id=str(d.id),
                name=d.name,
                description=d.description,
            )
            for d in depts_list
        ]
        department_options = [
            FilterOption(value=str(d.id), label=d.name) for d in depts_list
        ]

        # ── Date range from tests ─────────────────────────────────────
        date_range_earliest: str | None = None
        date_range_latest: str | None = None
        if tests:
            dates = [t.test_created_at for t in tests if t.test_created_at]
            if dates:
                date_range_earliest = min(dates).isoformat()
                date_range_latest = max(dates).isoformat()

        # ── Build history from search context ─────────────────────────
        history = _build_history(history_ctx, request)

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return BenchmarkResponse(
            evals=eval_cards,
            departments=department_items,
            department_options=department_options,
            date_range_earliest=date_range_earliest,
            date_range_latest=date_range_latest,
            history=history,
            analytics=analytics_facets,
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


# =============================================================================
# Internal helpers
# =============================================================================


async def _resolve_both(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    request: BenchmarkRequest,
    department_ids: list[UUID] | None,
    date_from: datetime | None,
    date_to: datetime | None,
    bypass_cache: bool,
) -> tuple[ArtifactContext, ArtifactContext]:
    """Resolve cards + history contexts in parallel."""
    eval_uuids = (
        [UUID(e) for e in request.history_eval_ids]
        if request.history_eval_ids
        else None
    )

    cards_task = resolve_benchmark_context(
        pool,
        redis,
        department_ids=department_ids,
        date_from=date_from,
        date_to=date_to,
        bypass_cache=bypass_cache,
    )
    history_task = resolve_benchmark_search_context(
        pool,
        redis,
        eval_ids=eval_uuids,
        department_ids=department_ids,
        date_from=date_from,
        date_to=date_to,
        is_archived=request.history_archived,
        sort_order=request.history_sort_order,
        limit=request.history_page_size,
        offset=request.history_page * request.history_page_size,
        bypass_cache=bypass_cache,
    )

    return await asyncio.gather(cards_task, history_task)


def _build_eval_cards(
    benchmarks: list,
    invocations: list,
    tests: list,
    test_invocations: list,
    evals_list: list,
) -> list[BenchmarkEvalOperational]:
    """Build eval cards with aggregated stats — pure Python."""

    # Index invocations by benchmark_id for model_ids lookup
    inv_by_benchmark: dict[UUID, list] = defaultdict(list)
    for inv in invocations:
        if inv.benchmark_id:
            inv_by_benchmark[inv.benchmark_id].append(inv)

    # Map benchmark → eval_ids + department_ids + model_ids per eval
    model_ids_per_eval: dict[UUID, set[UUID]] = defaultdict(set)
    dept_ids_per_eval: dict[UUID, set[str]] = defaultdict(set)

    for b in benchmarks:
        b_invs = inv_by_benchmark.get(b.benchmark_id, [])
        b_model_ids: set[UUID] = set()
        for inv in b_invs:
            for mid in inv.model_ids or []:
                b_model_ids.add(mid)

        for eid in b.eval_ids or []:
            model_ids_per_eval[eid].update(b_model_ids)
            for did in b.department_ids or []:
                dept_ids_per_eval[eid].add(str(did))

    # Count tests per eval
    tests_per_eval: Counter[UUID] = Counter()
    archived_per_eval: Counter[UUID] = Counter()
    test_ids_per_eval: dict[UUID, list[UUID]] = defaultdict(list)
    infinite_per_eval: dict[UUID, bool] = {}

    for t in tests:
        if t.eval_id:
            tests_per_eval[t.eval_id] += 1
            test_ids_per_eval[t.eval_id].append(t.test_id)
            if t.archived:
                archived_per_eval[t.eval_id] += 1
            if t.infinite_mode:
                infinite_per_eval[t.eval_id] = True

    # Index test_invocations by test_id
    ti_by_test: dict[UUID, list] = defaultdict(list)
    for ti in test_invocations:
        if ti.test_id:
            ti_by_test[ti.test_id].append(ti)

    # Aggregate per-eval stats from test_invocations
    eval_stats: dict[UUID, dict] = {}
    for eid, t_ids in test_ids_per_eval.items():
        total = 0
        completed = 0
        highest: float | None = None
        passed = False
        rubric_ids: set[UUID] = set()

        for tid in t_ids:
            for ti in ti_by_test.get(tid, []):
                total += 1
                if ti.invocation_completed:
                    completed += 1
                if ti.grade_passed:
                    passed = True
                if ti.grade_score is not None:
                    if highest is None or ti.grade_score > highest:
                        highest = ti.grade_score
                if ti.rubric_id:
                    rubric_ids.add(ti.rubric_id)

        eval_stats[eid] = {
            "total_invocations": total,
            "completed_invocations": completed,
            "highest_score": highest,
            "has_passed": passed,
            "rubric_ids": rubric_ids,
        }

    # Build cards from hydrated evals
    eval_map = {ev.id: ev for ev in evals_list if ev.id}
    cards: list[BenchmarkEvalOperational] = []

    for eid, ev in eval_map.items():
        stats = eval_stats.get(eid, {})
        total_inv = stats.get("total_invocations", 0)
        completed_inv = stats.get("completed_invocations", 0)
        has_passed = stats.get("has_passed", False)

        cards.append(
            BenchmarkEvalOperational(
                eval_id=str(eid),
                eval_name=ev.name,
                eval_description=ev.description,
                model_ids=sorted(str(m) for m in model_ids_per_eval.get(eid, set())),
                total_tests=tests_per_eval.get(eid, 0),
                archived_tests=archived_per_eval.get(eid, 0),
                total_invocations=total_inv,
                completed_invocations=completed_inv,
                highest_score=stats.get("highest_score"),
                has_passed=has_passed,
                status=compute_benchmark_eval_status(
                    has_passed, completed_inv, total_inv
                ),
                infinite_mode=infinite_per_eval.get(eid, False),
                department_ids=sorted(dept_ids_per_eval.get(eid, set())),
                rubric_ids=sorted(str(r) for r in stats.get("rubric_ids", set())),
            )
        )

    return cards


def _build_history(
    ctx: ArtifactContext,
    request: BenchmarkRequest,
) -> BenchmarkHistoryResponse:
    """Build paginated history from search context — pure Python."""
    tests = ctx.entries.get("tests", [])
    test_invocations = ctx.entries.get("test_invocations", [])
    evals_list = ctx.resources["evals"].selected if "evals" in ctx.resources else []

    eval_map = {ev.id: ev for ev in evals_list if ev.id}

    # Index test_invocations by test_id
    ti_by_test: dict[UUID, list] = defaultdict(list)
    for ti in test_invocations:
        if ti.test_id:
            ti_by_test[ti.test_id].append(ti)

    items: list[BenchmarkHistoryItem] = []
    eval_counter: Counter[str] = Counter()
    eval_id_to_name: dict[str, str | None] = {}

    for t in tests:
        tis = ti_by_test.get(t.test_id, [])
        total_inv = len(tis)
        completed_inv = sum(1 for ti in tis if ti.invocation_completed)
        pending_inv = total_inv - completed_inv

        best_score: float | None = None
        has_passed = False
        for ti in tis:
            if ti.grade_passed:
                has_passed = True
            if ti.grade_score is not None:
                if best_score is None or ti.grade_score > best_score:
                    best_score = ti.grade_score

        eval_name: str | None = None
        eval_desc: str | None = None
        if t.eval_id and t.eval_id in eval_map:
            eval_name = eval_map[t.eval_id].name
            eval_desc = eval_map[t.eval_id].description

        if t.eval_id:
            eid_str = str(t.eval_id)
            eval_counter[eid_str] += 1
            if eid_str not in eval_id_to_name:
                eval_id_to_name[eid_str] = eval_name

        items.append(
            BenchmarkHistoryItem(
                test_id=str(t.test_id),
                eval_id=str(t.eval_id) if t.eval_id else None,
                eval_name=eval_name,
                eval_description=eval_desc,
                created_at=(
                    t.test_created_at.isoformat() if t.test_created_at else None
                ),
                archived=t.archived,
                infinite_mode=t.infinite_mode,
                total_invocations=total_inv,
                completed_invocations=completed_inv,
                pending_invocations=pending_inv,
                best_score=best_score,
                has_passed=has_passed,
                status=compute_test_status(total_inv, completed_inv),
            )
        )

    eval_options = [
        FilterOption(value=eid, label=eval_id_to_name.get(eid), count=count)
        for eid, count in eval_counter.items()
    ]
    eval_options.sort(key=lambda o: o.value)

    # Total count: for paginated history, we use len(tests) from search context
    # since search_tests returns the filtered page
    return BenchmarkHistoryResponse(
        data=items,
        total_count=len(items),
        page=request.history_page,
        page_size=request.history_page_size,
        eval_options=eval_options,
    )
