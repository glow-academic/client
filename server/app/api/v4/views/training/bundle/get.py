"""Get endpoint for training bundle view."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.views.training.bundle.types import GetTrainingBundleViewResponse
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import GetTrainingBundleViewSqlParams
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/training/bundle/get_training_bundle_view_complete.sql"
)

router = APIRouter()


async def get_training_bundle_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_bundle_entry_id: UUID,
) -> GetTrainingBundleViewResponse:
    """Thin DB-backed bundle scope lookup used by training artifacts."""
    params = GetTrainingBundleViewSqlParams(
        profile_id_filter=profile_id,
        training_bundle_entry_id_filter=training_bundle_entry_id,
    )
    row = await execute_sql_typed(conn, SQL_PATH, params=params)

    if not row:
        return GetTrainingBundleViewResponse()

    return GetTrainingBundleViewResponse(
        profile_has_access=row.profile_has_access or False,
        training_bundle_entry_id=row.training_bundle_entry_id,
        training_id=row.training_id,
        simulation_id=row.simulation_id,
        simulation_name=row.simulation_name,
        scenario_id=row.scenario_id,
        department_ids=list(row.department_ids or []),
        persona_ids=list(row.persona_ids or []),
        document_ids=list(row.document_ids or []),
        parameter_field_ids=list(row.parameter_field_ids or []),
        scenario_time_limit_ids=list(row.scenario_time_limit_ids or []),
    )


@router.post("/get", response_model=GetTrainingBundleViewResponse)
async def get_training_bundle_view(
    request: Request,
    training_bundle_entry_id: UUID,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTrainingBundleViewResponse:
    """Get thin bundle scope for a single training bundle entry."""
    try:
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(status_code=401, detail="Profile ID is required")

        return await get_training_bundle_view_internal(
            conn=conn,
            profile_id=cast(UUID, profile_id),
            training_bundle_entry_id=training_bundle_entry_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="views_training_bundle_get",
            sql_query=None,
            sql_params=None,
            request=request,
        )
