"""Benchmark test artifact detail endpoint."""

import asyncio
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.test.permissions import compute_test_status
from app.api.v4.artifacts.test.types import (
    GetTestArtifactRequest,
    GetTestArtifactResponse,
    TestRunItem,
    TestStatusSummary,
)
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.views.benchmark.invocations.get import (
    get_benchmark_invocations_internal,
)
from app.api.v4.views.benchmark.tests.get import get_benchmark_tests_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/get",
    response_model=GetTestArtifactResponse,
    dependencies=[
        audit_activity(
            "artifacts.test.get",
            "{{ actor.name }} fetched test artifact data",
        )
    ],
)
async def get_test_artifact(
    request: GetTestArtifactRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestArtifactResponse:
    """Get benchmark test artifact details with tests/invocations in parallel."""
    tags = ["artifacts", "test"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        async def fetch_tests() -> list:
            async with pool.acquire() as c:
                result = await get_benchmark_tests_internal(
                    conn=c,
                    test_ids=[request.test_id],
                    bypass_cache=bypass_cache,
                    page_limit=1,
                    page_offset=0,
                )
                return result.items

        async def fetch_invocations() -> list:
            async with pool.acquire() as c:
                return await get_benchmark_invocations_internal(
                    conn=c,
                    test_id=request.test_id,
                    bypass_cache=bypass_cache,
                )

        tests, invocations = await asyncio.gather(fetch_tests(), fetch_invocations())

        test = tests[0] if tests else None
        if not test:
            raise HTTPException(status_code=404, detail="Benchmark test not found")

        status = compute_test_status(test.num_chats, test.num_chats_completed)

        # --- Hydration: collect IDs ---
        eval_name_ids: set[UUID] = set()
        eval_description_ids: set[UUID] = set()
        rubric_ids: set[UUID] = set()

        if test.eval_name_id:
            eval_name_ids.add(test.eval_name_id)
        if test.eval_description_id:
            eval_description_ids.add(test.eval_description_id)
        if test.rubric_id:
            rubric_ids.add(test.rubric_id)

        # Collect all run_ids from invocations for model/agent name resolution
        all_run_ids: list[UUID] = []
        for invocation in invocations:
            if invocation.run_ids:
                all_run_ids.extend(invocation.run_ids)

        # Resolve run_ids → model/agent name_ids
        run_name_map: dict[UUID, tuple[UUID | None, UUID | None]] = {}
        if all_run_ids:
            async with pool.acquire() as c:
                rows = await c.fetch(
                    """
                    SELECT rrc.runs_id,
                           mnj.name_id AS model_name_id,
                           anj.name_id AS agent_name_id
                    FROM runs_runs_connection rrc
                    JOIN runs_entry re ON re.id = rrc.run_id
                    LEFT JOIN config_agents_connection cac ON cac.config_id = re.config_id AND cac.active = true
                    LEFT JOIN agent_names_junction anj ON anj.agent_id = cac.agents_id AND anj.active = true
                    LEFT JOIN model_runs_junction mrj ON mrj.run_id = re.id AND mrj.active = true
                    LEFT JOIN model_names_junction mnj ON mnj.model_id = mrj.model_id AND mnj.active = true
                    WHERE rrc.runs_id = ANY($1::uuid[]) AND rrc.active = true
                    """,
                    all_run_ids,
                )
                for row in rows:
                    model_nid = row["model_name_id"]
                    agent_nid = row["agent_name_id"]
                    run_name_map[row["runs_id"]] = (model_nid, agent_nid)
                    if model_nid:
                        eval_name_ids.add(model_nid)
                    if agent_nid:
                        eval_name_ids.add(agent_nid)

        # Batch resolve names, descriptions, rubrics
        async with pool.acquire() as c:
            names_list = await get_names_internal(
                c, list(eval_name_ids), bypass_cache=bypass_cache
            )
            desc_list = await get_descriptions_internal(
                c, list(eval_description_ids), bypass_cache=bypass_cache
            )
            rubrics_list = await get_rubrics_batch_internal(
                c, list(rubric_ids), bypass_cache=bypass_cache
            )

        # Build lookup maps
        name_map: dict[UUID, str] = {}
        for n in names_list:
            if n.id and n.name:
                name_map[n.id] = n.name

        desc_map: dict[UUID, str] = {}
        for d in desc_list:
            if d.id and d.description:
                desc_map[d.id] = d.description

        rubric_name_map: dict[UUID, str] = {}
        for r in rubrics_list:
            if r.rubric_id and r.name:
                rubric_name_map[r.rubric_id] = r.name

        # Hydrated eval info
        eval_name = name_map.get(test.eval_name_id) if test.eval_name_id else None
        eval_description = (
            desc_map.get(test.eval_description_id) if test.eval_description_id else None
        )
        rubric_name = rubric_name_map.get(test.rubric_id) if test.rubric_id else None

        # Build runs list from invocations
        runs: list[TestRunItem] = []
        completed_count = 0
        in_progress_count = 0
        not_started_count = 0

        for invocation in invocations:
            first_run_id = invocation.run_ids[0] if invocation.run_ids else None
            first_group_id = invocation.group_id

            model_name: str | None = None
            agent_name: str | None = None
            if first_run_id and first_run_id in run_name_map:
                model_nid, agent_nid = run_name_map[first_run_id]
                if model_nid:
                    model_name = name_map.get(model_nid)
                if agent_nid:
                    agent_name = name_map.get(agent_nid)

            invocation_status = (
                "completed" if invocation.invocation_completed else "not_started"
            )
            if invocation_status == "completed":
                completed_count += 1
            else:
                not_started_count += 1

            runs.append(
                TestRunItem(
                    chat_id=str(invocation.invocation_id),
                    invocation_id=str(invocation.invocation_id),
                    run_id=str(first_run_id) if first_run_id else None,
                    group_id=str(first_group_id) if first_group_id else None,
                    model_name=model_name,
                    agent_name=agent_name,
                    status=invocation_status,
                    grade_score=invocation.grade_score,
                    grade_passed=invocation.grade_passed,
                )
            )

        status_summary = TestStatusSummary(
            total=len(runs),
            completed=completed_count,
            in_progress=in_progress_count,
            not_started=not_started_count,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestArtifactResponse(
            test=test,
            invocations=invocations,
            status=status,
            eval_name=eval_name,
            eval_description=eval_description,
            rubric_name=rubric_name,
            infinite_mode=test.infinite_mode,
            runs=runs,
            status_summary=status_summary,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_test_get",
            request=http_request,
        )
