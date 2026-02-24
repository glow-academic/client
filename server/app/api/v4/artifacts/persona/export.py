"""Persona export endpoint - generates CSV and stores via upload infrastructure."""

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
    GetPersonasListSqlParams,
    GetPersonasListSqlRow,
    InsertUploadSqlParams,
    InsertUploadSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

LIST_SQL_PATH = "app/sql/v4/queries/personas/get_personas_list_complete.sql"
UPLOAD_SQL_PATH = "app/sql/v4/queries/uploads/insert_upload_complete.sql"

# CSV columns for persona export
CSV_COLUMNS = [
    "name",
    "description",
    "color",
    "icon",
    "is_inactive",
    "num_scenarios",
    "updated_at",
]

router = APIRouter()


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

    sql_query = load_sql_query(LIST_SQL_PATH)

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

        # Query persona list with filters (no pagination for export — fetch all)
        params = GetPersonasListSqlParams(
            profile_id=profile_id,
            search=request.search,
            scenario_ids=request.scenario_ids,
            field_ids=request.field_ids,
            filter_department_ids=request.filter_department_ids,
            scenario_search=None,
            field_search=None,
            department_search=None,
            page_size=None,
            page_offset=None,
        )

        result = cast(
            GetPersonasListSqlRow,
            await execute_sql_typed(conn, LIST_SQL_PATH, params=params),
        )

        personas = result.personas or []

        # Generate CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(CSV_COLUMNS)

        for persona in personas:
            writer.writerow(
                [
                    persona.name or "",
                    persona.description or "",
                    persona.color or "",
                    persona.icon or "",
                    "Yes" if persona.is_inactive else "No",
                    persona.num_scenarios or 0,
                    persona.updated_at.isoformat() if persona.updated_at else "",
                ]
            )

        csv_content = output.getvalue()
        row_count = len(personas)

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
