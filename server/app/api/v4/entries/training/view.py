"""View wrapper for training bundle entries."""

from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/training/bundle/get_training_view_complete.sql"


class GetTrainingViewResponse(BaseModel):
    """Thin MV-backed view response for a single training bundle."""

    profile_has_access: bool = False
    training_entry_id: UUID | None = None
    parent_id: UUID | None = None
    scenario_id: UUID | None = None
    department_ids: list[UUID] = Field(default_factory=list)
    persona_ids: list[UUID] = Field(default_factory=list)
    document_ids: list[UUID] = Field(default_factory=list)
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)
    question_ids: list[UUID] = Field(default_factory=list)
    option_ids: list[UUID] = Field(default_factory=list)
    video_ids: list[UUID] = Field(default_factory=list)
    image_ids: list[UUID] = Field(default_factory=list)
    problem_statement_ids: list[UUID] = Field(default_factory=list)
    objective_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
    video_enabled: bool = False
    problem_statement_enabled: bool = False
    objectives_enabled: bool = False
    images_enabled: bool = False
    questions_enabled: bool = False


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
