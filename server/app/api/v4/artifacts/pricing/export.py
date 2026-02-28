"""Pricing export endpoint — group-level analytical CSV dump."""

import csv
import io
import os
from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.group.types import GetGroupListRequest
from app.api.v4.artifacts.pricing.get import get_group_list_internal
from app.api.v4.artifacts.pricing.types import (
    ExportPricingApiRequest,
    ExportPricingApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import UPLOAD_FOLDER, get_db, get_pool
from app.sql.types import (
    InsertUploadSqlParams,
    InsertUploadSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

UPLOAD_SQL_PATH = "app/sql/v4/queries/uploads/insert_upload_complete.sql"

PIPE = "|"

CSV_COLUMNS = [
    "group_id",
    "group_name",
    "session_id",
    "trace_id",
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


@router.post(
    "/export",
    response_model=ExportPricingApiResponse,
    dependencies=[
        audit_activity(
            "pricing.exported",
            "{{ actor.name }} exported pricing data",
        )
    ],
)
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

        # Fetch user context for audit
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
                    item.trace_id or "",
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
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
            )

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
