"""Persona export endpoint - generates round-trip CSV with full resource IDs and values."""

import csv
import io
import os
from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.types import (
    ExportPersonaApiRequest,
    ExportPersonaApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import UPLOAD_FOLDER, get_db, get_pool
from app.sql.types import (
    ExportPersonasSqlParams,
    ExportPersonasSqlRow,
    InsertUploadSqlParams,
    InsertUploadSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

EXPORT_SQL_PATH = "app/sql/v4/queries/personas/export_personas_complete.sql"
UPLOAD_SQL_PATH = "app/sql/v4/queries/uploads/insert_upload_complete.sql"

PIPE = "|"

# CSV columns for round-trip persona export (ID + value pairs)
CSV_COLUMNS = [
    "persona_id",
    "name_id",
    "name",
    "description_id",
    "description",
    "color_id",
    "color",
    "icon_id",
    "icon",
    "instructions_id",
    "instructions",
    "is_inactive",
    "department_ids",
    "departments",
    "example_ids",
    "examples",
    "parameter_field_ids",
    "parameter_fields",
    "voice_ids",
    "voices",
]

router = APIRouter()


def _pipe_uuids(ids: list[UUID] | None) -> str:
    """Format a list of UUIDs as pipe-delimited string."""
    if not ids:
        return ""
    return PIPE.join(str(uid) for uid in ids)


def _pipe_strings(vals: list[str] | None) -> str:
    """Format a list of strings as pipe-delimited string."""
    if not vals:
        return ""
    return PIPE.join(vals)


@router.post(
    "/export",
    response_model=ExportPersonaApiResponse,
    dependencies=[
        audit_activity(
            "persona.exported",
            "{{ actor.name }} exported personas",
        )
    ],
)
async def export_personas(
    request: ExportPersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ExportPersonaApiResponse:
    """Export personas as CSV — stores file via upload infrastructure, returns upload_id."""

    sql_query = load_sql_query(EXPORT_SQL_PATH)

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for audit
        pool = get_pool()
        actor_name = None
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name

        # Query full persona data for export (no pagination)
        params = ExportPersonasSqlParams(
            profile_id=profile_id,
            search=request.search,
            scenario_ids=request.scenario_ids,
            field_ids=request.field_ids,
            filter_department_ids=request.filter_department_ids,
        )

        result = cast(
            ExportPersonasSqlRow,
            await execute_sql_typed(conn, EXPORT_SQL_PATH, params=params),
        )

        rows = result.rows or []

        # Generate CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(CSV_COLUMNS)

        for row in rows:
            writer.writerow(
                [
                    str(row.persona_id) if row.persona_id else "",
                    str(row.name_id) if row.name_id else "",
                    row.name or "",
                    str(row.description_id) if row.description_id else "",
                    row.description or "",
                    str(row.color_id) if row.color_id else "",
                    row.color or "",
                    str(row.icon_id) if row.icon_id else "",
                    row.icon or "",
                    str(row.instructions_id) if row.instructions_id else "",
                    row.instructions or "",
                    "Yes" if row.is_inactive else "No",
                    _pipe_uuids(row.department_ids),
                    _pipe_strings(row.departments),
                    _pipe_uuids(row.example_ids),
                    _pipe_strings(row.examples),
                    _pipe_uuids(row.parameter_field_ids),
                    _pipe_strings(row.parameter_fields),
                    _pipe_uuids(row.voice_ids),
                    _pipe_strings(row.voices),
                ]
            )

        csv_content = output.getvalue()
        row_count = len(rows)

        # Write CSV to upload folder
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        file_name = f"personas_export_{timestamp}.csv"
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

        return ExportPersonaApiResponse(
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
            operation="export_personas",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
