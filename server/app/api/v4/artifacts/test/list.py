"""Benchmark test artifact list endpoint."""

from collections import Counter
from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.api.v4.artifacts.test.permissions import compute_test_status
from app.api.v4.artifacts.test.types import (
    GetTestListRequest,
    GetTestListResponse,
    TestListFilterOption,
    TestListItem,
)
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.views.benchmark.tests.get import get_benchmark_tests_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

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
    """List benchmark tests with enriched names."""
    tags = ["artifacts", "test"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:
        # Convert page/page_size to page_limit/page_offset
        page_limit = request.page_size
        page_offset = request.page * request.page_size

        # Convert string eval_ids to UUIDs
        eval_uuids = [UUID(e) for e in request.eval_ids] if request.eval_ids else None
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

        # Fetch tests from MV
        result = await get_benchmark_tests_internal(
            conn=conn,
            eval_ids=eval_uuids,
            department_ids=department_uuids,
            date_from=date_from,
            date_to=date_to,
            archived=request.archived,
            search=request.search,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
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
        items: list[TestListItem] = []
        eval_counter: Counter[str] = Counter()
        eval_id_to_name: dict[str, str | None] = {}

        for row in result.items:
            eval_name = name_map.get(row.eval_name_id) if row.eval_name_id else None
            eval_desc = (
                desc_map.get(row.eval_description_id)
                if row.eval_description_id
                else None
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
                TestListItem(
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
            TestListFilterOption(
                value=eval_id,
                label=eval_id_to_name.get(eval_id),
                count=count,
            )
            for eval_id, count in eval_counter.items()
        ]
        eval_options.sort(key=lambda option: option.value)

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestListResponse(
            data=items,
            total_count=result.total_count,
            page=request.page,
            page_size=request.page_size,
            eval_options=eval_options,
        )
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_test_list",
            request=http_request,
        )
