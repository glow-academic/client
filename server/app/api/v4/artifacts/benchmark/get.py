"""Get endpoint for benchmark artifact."""

import asyncio
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.benchmark.types import (
    BenchmarkAgentItem,
    BenchmarkDepartmentItem,
    BenchmarkEvalItem,
    BenchmarkRequest,
    BenchmarkResponse,
    BenchmarkRubricItem,
    BenchmarkRubricStandardGroupItem,
    BenchmarkStandardGroupItem,
    BenchmarkStandardItem,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.resources.standard_groups.types import get_standard_groups_internal
from app.api.v4.resources.standards.types import get_standards_internal
from app.api.v4.views.benchmark.eval_summary.get import (
    get_benchmark_eval_summary_internal,
)
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

        # Step 1: Fetch eval summary from MV and date range in parallel
        # Each branch acquires its own connection since asyncpg doesn't
        # support concurrent operations on a single connection.
        async def fetch_eval_summary():
            async with pool.acquire() as c:
                return await get_benchmark_eval_summary_internal(
                    conn=c,
                    department_ids=department_uuids,
                    page_limit=200,
                    bypass_cache=bypass_cache,
                )

        async def fetch_benchmark_date_range() -> tuple[str | None, str | None]:
            async with pool.acquire() as c:
                if not department_uuids:
                    row = await c.fetchrow(
                        """
                        SELECT MIN(created_at) as earliest, MAX(created_at) as latest
                        FROM mv_benchmark_eval_summary
                        """
                    )
                else:
                    row = await c.fetchrow(
                        """
                        SELECT MIN(created_at) as earliest, MAX(created_at) as latest
                        FROM mv_benchmark_eval_summary
                        WHERE department_ids && $1::uuid[]
                        """,
                        department_uuids,
                    )
                if row and row["earliest"]:
                    return (
                        row["earliest"].isoformat(),
                        row["latest"].isoformat(),
                    )
                return (None, None)

        eval_summary_result, benchmark_date_range = await asyncio.gather(
            fetch_eval_summary(),
            fetch_benchmark_date_range(),
        )

        # Step 2: Collect all unique IDs from results
        eval_name_ids: set[UUID] = set()
        eval_description_ids: set[UUID] = set()
        agent_name_ids: set[UUID] = set()
        rubric_ids: set[UUID] = set()
        all_department_ids: set[UUID] = set()
        all_agent_ids: set[UUID] = set()

        for item in eval_summary_result.items:
            if item.eval_name_id:
                eval_name_ids.add(item.eval_name_id)
            if item.eval_description_id:
                eval_description_ids.add(item.eval_description_id)
            if item.agent_name_ids:
                agent_name_ids.update(item.agent_name_ids)
            if item.rubric_id:
                rubric_ids.add(item.rubric_id)
            if item.department_ids:
                all_department_ids.update(item.department_ids)
            if item.agent_ids:
                all_agent_ids.update(item.agent_ids)

        # Step 3: Batch resolve names and descriptions
        async with pool.acquire() as c:
            eval_names = await get_names_internal(
                c, list(eval_name_ids), bypass_cache=bypass_cache
            )
            eval_descriptions = await get_descriptions_internal(
                c, list(eval_description_ids), bypass_cache=bypass_cache
            )
            agent_names = await get_names_internal(
                c, list(agent_name_ids), bypass_cache=bypass_cache
            )

        # Build name/description lookup maps
        name_map: dict[UUID, str] = {}
        for n in eval_names:
            if n.id and n.name:
                name_map[n.id] = n.name
        for n in agent_names:
            if n.id and n.name:
                name_map[n.id] = n.name

        desc_map: dict[UUID, str] = {}
        for d in eval_descriptions:
            if d.id and d.description:
                desc_map[d.id] = d.description

        # Step 4: Batch resolve rubrics, departments
        async with pool.acquire() as c:
            rubrics = await get_rubrics_batch_internal(
                c, list(rubric_ids), bypass_cache=bypass_cache
            )
            departments = await get_departments_internal(
                c, list(all_department_ids), bypass_cache=bypass_cache
            )

        # Build rubric name map
        rubric_name_map: dict[UUID, str] = {}
        for r in rubrics:
            if r.rubric_id and r.name:
                rubric_name_map[r.rubric_id] = r.name

        # Step 5: Collect standard_group_ids from rubric_standard_groups_junction
        rubric_sg_mapping: dict[str, list[tuple[str, list[str]]]] = {}
        all_standard_group_ids: set[UUID] = set()

        if rubric_ids:
            sg_rows = await conn.fetch(
                """
                SELECT rsg.rubric_id, rsg.standard_group_id
                FROM rubric_standard_groups_junction rsg
                WHERE rsg.rubric_id = ANY($1::uuid[])
                  AND rsg.active = true
                ORDER BY rsg.position
                """,
                list(rubric_ids),
            )
            for row in sg_rows:
                rid = str(row["rubric_id"])
                sgid = row["standard_group_id"]
                all_standard_group_ids.add(sgid)
                if rid not in rubric_sg_mapping:
                    rubric_sg_mapping[rid] = []
                rubric_sg_mapping[rid].append((str(sgid), []))

        # Step 6: Fetch standard groups and standards
        all_standard_ids: set[UUID] = set()
        standard_groups_list = []
        standards_list = []

        if all_standard_group_ids:
            async with pool.acquire() as c:
                standard_groups_list = await get_standard_groups_internal(
                    c, list(all_standard_group_ids), bypass_cache=bypass_cache
                )

            # Fetch standards belonging to these standard groups
            std_rows = await conn.fetch(
                """
                SELECT s.id AS standard_id, s.standard_group_id
                FROM standards_resource s
                WHERE s.standard_group_id = ANY($1::uuid[])
                  AND s.active = true
                """,
                list(all_standard_group_ids),
            )
            std_ids_by_group: dict[str, list[str]] = {}
            for row in std_rows:
                sgid = str(row["standard_group_id"])
                sid = row["standard_id"]
                all_standard_ids.add(sid)
                if sgid not in std_ids_by_group:
                    std_ids_by_group[sgid] = []
                std_ids_by_group[sgid].append(str(sid))

            # Populate standard_ids in rubric_sg_mapping
            for rid, groups in rubric_sg_mapping.items():
                for i, (sgid, _) in enumerate(groups):
                    groups[i] = (sgid, std_ids_by_group.get(sgid, []))

            if all_standard_ids:
                async with pool.acquire() as c:
                    standards_list = await get_standards_internal(
                        c, list(all_standard_ids), bypass_cache=bypass_cache
                    )

        # Step 7: Build enriched eval items
        evals: list[BenchmarkEvalItem] = []
        for item in eval_summary_result.items:
            eval_name = name_map.get(item.eval_name_id) if item.eval_name_id else None
            eval_desc = (
                desc_map.get(item.eval_description_id)
                if item.eval_description_id
                else None
            )
            rubric_name = (
                rubric_name_map.get(item.rubric_id) if item.rubric_id else None
            )

            evals.append(
                BenchmarkEvalItem(
                    eval_id=str(item.eval_id),
                    name=eval_name,
                    description=eval_desc,
                    rubric_id=str(item.rubric_id) if item.rubric_id else None,
                    rubric_name=rubric_name,
                    agent_ids=[str(a) for a in item.agent_ids]
                    if item.agent_ids
                    else [],
                    department_ids=(
                        [str(d) for d in item.department_ids]
                        if item.department_ids
                        else []
                    ),
                    use_groups=item.use_groups,
                    dynamic=item.dynamic,
                    total_runs=item.total_runs,
                    completed_runs=item.completed_runs,
                    pending_runs=item.pending_runs,
                    status=item.status,
                )
            )

        # Step 8: Build resource arrays
        rubric_items = [
            BenchmarkRubricItem(
                rubric_id=str(r.rubric_id),
                name=r.name,
                description=r.description,
                points=r.total_points,
                pass_points=r.pass_points,
            )
            for r in rubrics
            if r.rubric_id
        ]

        department_items = [
            BenchmarkDepartmentItem(
                department_id=str(d.department_id),
                name=d.name,
                description=d.description,
            )
            for d in departments
            if d.department_id
        ]

        # Build agent items from agent_ids + agent_name_ids
        # Map agent_id → agent_name using eval_summary agent_ids ↔ agent_name_ids
        agent_id_to_name: dict[str, str | None] = {}
        for item in eval_summary_result.items:
            if item.agent_ids and item.agent_name_ids:
                for aid, anid in zip(item.agent_ids, item.agent_name_ids):
                    if str(aid) not in agent_id_to_name:
                        agent_id_to_name[str(aid)] = name_map.get(anid)

        agent_items = [
            BenchmarkAgentItem(
                agent_id=str(aid),
                name=agent_id_to_name.get(str(aid)),
            )
            for aid in all_agent_ids
        ]

        standard_group_items = [
            BenchmarkStandardGroupItem(
                standard_group_id=str(sg.standard_group_id),
                name=sg.name,
                description=sg.description,
                points=sg.points,
                pass_points=sg.pass_points,
            )
            for sg in standard_groups_list
            if sg.standard_group_id
        ]

        standard_items = [
            BenchmarkStandardItem(
                standard_id=str(s.standard_id),
                standard_group_id=str(s.standard_group_id)
                if s.standard_group_id
                else None,
                name=s.name,
                description=s.description,
                points=s.points,
            )
            for s in standards_list
            if s.standard_id
        ]

        rubric_standard_groups = []
        for rid, groups in rubric_sg_mapping.items():
            for sgid, sids in groups:
                rubric_standard_groups.append(
                    BenchmarkRubricStandardGroupItem(
                        rubric_id=rid,
                        standard_group_id=sgid,
                        standard_ids=sids,
                    )
                )

        # Step 9: Build filter options with labels
        rubric_options = [
            FilterOption(value=str(r.rubric_id), label=r.name)
            for r in rubrics
            if r.rubric_id
        ]

        department_options = [
            FilterOption(value=str(d.department_id), label=d.name)
            for d in departments
            if d.department_id
        ]

        agent_options = [
            FilterOption(
                value=str(aid),
                label=agent_id_to_name.get(str(aid)),
            )
            for aid in all_agent_ids
        ]

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return BenchmarkResponse(
            evals=evals,
            rubrics=rubric_items,
            departments=department_items,
            agents=agent_items,
            standard_groups=standard_group_items,
            standards=standard_items,
            rubric_standard_groups=rubric_standard_groups,
            rubric_options=rubric_options,
            department_options=department_options,
            agent_options=agent_options,
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
