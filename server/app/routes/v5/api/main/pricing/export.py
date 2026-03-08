"""Pricing export endpoint — group-level analytical CSV dump."""

import csv
import io
import os
from datetime import datetime
from decimal import Decimal
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import UPLOAD_FOLDER, get_db, get_pool, get_redis_client
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main._shared.pricing import compute_costs_from_runs
from app.routes.v5.api.main.group.types import (
    GetGroupListRequest,
    GetGroupListResponse,
    GroupListItem,
)
from app.routes.v5.api.main.pricing.types import (
    ExportPricingApiRequest,
    ExportPricingApiResponse,
)
from app.routes.v5.tools.entries.groups.get import get_group_list_view_internal
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.resources.names.get import get_names
from app.sql.types import (
    InsertUploadSqlParams,
    InsertUploadSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

UPLOAD_SQL_PATH = "app/sql/queries/uploads/insert_upload_complete.sql"

PIPE = "|"

CSV_COLUMNS = [
    "group_id",
    "group_name",
    "session_id",
    "first_run_at",
    "last_run_at",
    "run_count",
    "unique_agents",
    "unique_models",
    "total_input_tokens",
    "total_output_tokens",
    "total_tokens",
    "total_cost",
    "agents",
    "models",
]

router = APIRouter()


# ---------------------------------------------------------------------------
# Group list internal (used by export pagination)
# ---------------------------------------------------------------------------


async def get_group_list_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    request: GetGroupListRequest,
    actor_name: str | None = None,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v5/artifacts/group/list",
) -> GetGroupListResponse:
    """Internal function for group list with resource hydration."""
    body = request.model_dump(mode="json")
    cache_key_val = cache_key(cache_key_path, body)

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetGroupListResponse.model_validate(cached["data"])

    view_result = await get_group_list_view_internal(
        conn=conn,
        session_id_filter=request.session_id,
        date_from=request.date_from,
        date_to=request.date_to,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
        bypass_cache=bypass_cache,
    )

    group_ids = [item.group_id for item in view_result.items]

    if not group_ids:
        return GetGroupListResponse(
            actor_name=actor_name,
            items=[],
            total_count=view_result.total_count,
        )

    runs_result = await get_run_list_entries_internal(
        conn=conn,
        group_ids=group_ids,
        page_limit=10000,
        bypass_cache=bypass_cache,
    )

    run_costs = await compute_costs_from_runs(conn, runs_result.items, bypass_cache)

    group_stats: dict[UUID, dict] = {}
    all_agent_ids: set[UUID] = set()
    all_model_ids: set[UUID] = set()

    for run in runs_result.items:
        gid = run.group_id
        if not gid:
            continue
        if gid not in group_stats:
            group_stats[gid] = {
                "run_count": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_tokens": 0,
                "total_cost": Decimal("0"),
                "first_run_at": None,
                "last_run_at": None,
                "agent_ids": set(),
                "model_ids": set(),
            }
        stats = group_stats[gid]
        stats["run_count"] += 1
        stats["total_input_tokens"] += run.input_tokens
        stats["total_output_tokens"] += run.output_tokens
        stats["total_tokens"] += (
            run.input_tokens + run.output_tokens + run.cached_input_tokens
        )
        stats["total_cost"] += run_costs.get(run.run_id, Decimal("0"))
        if run.run_created_at:
            if (
                stats["first_run_at"] is None
                or run.run_created_at < stats["first_run_at"]
            ):
                stats["first_run_at"] = run.run_created_at
            if (
                stats["last_run_at"] is None
                or run.run_created_at > stats["last_run_at"]
            ):
                stats["last_run_at"] = run.run_created_at
        if run.agent_ids:
            stats["agent_ids"].update(run.agent_ids)
            all_agent_ids.update(run.agent_ids)
        if run.model_ids:
            stats["model_ids"].update(run.model_ids)
            all_model_ids.update(run.model_ids)

    all_name_ids = list(all_agent_ids | all_model_ids)
    name_items = (
        await get_names(
            conn, all_name_ids, get_redis_client(), bypass_cache=bypass_cache
        )
        if all_name_ids
        else []
    )
    name_map = {item.id: item.name for item in name_items if item.id and item.name}

    items = []
    for view_item in view_result.items:
        gid = view_item.group_id
        stats = group_stats.get(gid, {})
        agent_id_list = list(stats.get("agent_ids", set()))
        model_id_list = list(stats.get("model_ids", set()))
        a_names = [name_map[aid] for aid in agent_id_list if aid in name_map] or None
        m_names = [name_map[mid] for mid in model_id_list if mid in name_map] or None

        items.append(
            GroupListItem(
                group_id=gid,
                session_id=view_item.session_id,
                profile_id=None,
                group_name=view_item.group_name,
                first_run_at=stats.get("first_run_at"),
                last_run_at=stats.get("last_run_at"),
                run_count=stats.get("run_count", 0),
                unique_agents=len(agent_id_list),
                unique_models=len(model_id_list),
                total_input_tokens=stats.get("total_input_tokens", 0),
                total_output_tokens=stats.get("total_output_tokens", 0),
                total_tokens=stats.get("total_tokens", 0),
                total_cost=stats.get("total_cost", Decimal("0")),
                agent_ids=agent_id_list or None,
                model_ids=model_id_list or None,
                profile_name=None,
                agent_names=a_names,
                model_names=m_names,
            )
        )

    api_response = GetGroupListResponse(
        actor_name=actor_name,
        items=items,
        total_count=view_result.total_count,
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=["artifacts", "group", "list"],
        redis=get_redis_client(),
    )

    return api_response


def _pipe_strings(vals: list[str] | None) -> str:
    """Format a list of strings as pipe-delimited string."""
    if not vals:
        return ""
    return PIPE.join(vals)


def _fmt_dt(dt: datetime | None) -> str:
    """Format a datetime as ISO string, or empty."""
    if dt is None:
        return ""
    return dt.isoformat()


@router.post("/export", response_model=ExportPricingApiResponse)
async def export_pricing(
    request: ExportPricingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ExportPricingApiResponse:
    """Export pricing as CSV — group-level aggregated data."""

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        actor_name = None
        async with pool.acquire() as context_conn:
            profile_ctx = await get_auth_profile_internal(
                conn=context_conn,
                profile_id=profile_id,
                bypass_cache=False,
            )
            actor_name = profile_ctx.access.actor_name

        # Paginate through all groups
        all_items = []
        offset = 0
        page_size = 100
        while True:
            group_request_page = GetGroupListRequest(
                session_id=request.session_id,
                model_id=request.model_id,
                agent_id=request.agent_id,
                date_from=request.effective_date_from,
                date_to=request.effective_date_to,
                sort_by=request.sort_by,
                sort_order=request.sort_order,
                page_limit=page_size,
                page_offset=offset,
            )
            async with pool.acquire() as c:
                group_result = await get_group_list_internal(
                    conn=c,
                    profile_id=profile_id,
                    request=group_request_page,
                    actor_name=actor_name,
                    bypass_cache=True,
                )
            all_items.extend(group_result.items)
            if len(all_items) >= group_result.total_count or not group_result.items:
                break
            offset += page_size

        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(CSV_COLUMNS)

        for item in all_items:
            writer.writerow(
                [
                    str(item.group_id),
                    item.group_name or "",
                    str(item.session_id) if item.session_id else "",
                    _fmt_dt(item.first_run_at),
                    _fmt_dt(item.last_run_at),
                    item.run_count,
                    item.unique_agents,
                    item.unique_models,
                    item.total_input_tokens,
                    item.total_output_tokens,
                    item.total_tokens,
                    str(item.total_cost),
                    _pipe_strings(item.agent_names),
                    _pipe_strings(item.model_names),
                ]
            )

        csv_content = output.getvalue()
        row_count = len(all_items)

        # Write CSV to upload folder
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        file_name = f"pricing_export_{timestamp}.csv"
        file_path = os.path.join(str(UPLOAD_FOLDER), file_name)

        os.makedirs(str(UPLOAD_FOLDER), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(csv_content)

        # Insert into uploads_entry
        file_size = len(csv_content.encode("utf-8"))
        upload_params = InsertUploadSqlParams(
            file_path=file_name,
            mime_type="text/csv",
            size=file_size,
        )

        upload_result = cast(
            InsertUploadSqlRow,
            await execute_sql_typed(conn, UPLOAD_SQL_PATH, params=upload_params),
        )

        if not upload_result or not upload_result.id:
            raise ValueError("Failed to create upload record")

        upload_id = UUID(upload_result.id)

        # Audit
        return ExportPricingApiResponse(
            upload_id=upload_id,
            file_name=file_name,
            row_count=row_count,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="export_pricing",
            request=http_request,
        )
