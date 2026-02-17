"""Get endpoint for training bundle view."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.views.training.bundle.types import GetTrainingViewResponse
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/training/bundle/get_training_view_complete.sql"
)

router = APIRouter()


async def get_training_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_entry_id: UUID,
) -> GetTrainingViewResponse:
    """Thin MV-backed bundle scope lookup used by training artifacts."""
    from app.sql.types import GetTrainingViewSqlParams

    params = GetTrainingViewSqlParams(
        profile_id_filter=profile_id,
        training_entry_id_filter=training_entry_id,
    )
    row = await execute_sql_typed(conn, SQL_PATH, params=params)

    if not row:
        return GetTrainingViewResponse()

    return GetTrainingViewResponse(
        profile_has_access=row.profile_has_access or False,
        training_entry_id=row.training_entry_id,
        parent_id=row.parent_id,
        scenario_id=row.scenario_id,
        department_ids=list(row.department_ids or []),
        persona_ids=list(row.persona_ids or []),
        document_ids=list(row.document_ids or []),
        parameter_field_ids=list(row.parameter_field_ids or []),
        parameter_ids=list(row.parameter_ids or []),
        question_ids=list(row.question_ids or []),
        option_ids=list(row.option_ids or []),
        video_ids=list(row.video_ids or []),
        image_ids=list(row.image_ids or []),
        problem_statement_ids=list(row.problem_statement_ids or []),
        objective_ids=list(row.objective_ids or []),
        flag_ids=list(row.flag_ids or []),
        name_ids=list(row.name_ids or []),
        description_ids=list(row.description_ids or []),
        video_enabled=row.video_enabled or False,
        problem_statement_enabled=row.problem_statement_enabled or False,
        objectives_enabled=row.objectives_enabled or False,
        images_enabled=row.images_enabled or False,
        questions_enabled=row.questions_enabled or False,
    )


@router.post("/get", response_model=GetTrainingViewResponse)
async def get_training_view(
    request: Request,
    training_entry_id: UUID,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTrainingViewResponse:
    """Get thin bundle scope for a single training bundle entry."""
    try:
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(status_code=401, detail="Profile ID is required")

        return await get_training_view_internal(
            conn=conn,
            profile_id=cast(UUID, profile_id),
            training_entry_id=training_entry_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="views_training_get",
            sql_query=None,
            sql_params=None,
            request=request,
        )
