"""scenarios resource create endpoint - v4 API following DHH principles."""

from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL path for creating denormalized scenarios_resource
SQL_PATH = "app/sql/v4/queries/resources/scenarios/create_scenarios_complete.sql"


class CreateScenariosSqlParams(BaseModel):
    """SQL parameters for creating a denormalized scenarios_resource."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    problem_statement_ids: list[UUID] | None = None
    problem_statement_enabled: bool = True
    objectives_enabled: bool = True
    video_enabled: bool = False
    images_enabled: bool = False
    questions_enabled: bool = False
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.name_id,
            self.description_id,
            self.department_ids or [],
            self.persona_ids or [],
            self.parameter_field_ids or [],
            self.document_ids or [],
            self.objective_ids or [],
            self.image_ids or [],
            self.video_ids or [],
            self.question_ids or [],
            self.option_ids or [],
            self.problem_statement_ids or [],
            self.problem_statement_enabled,
            self.objectives_enabled,
            self.video_enabled,
            self.images_enabled,
            self.questions_enabled,
            self.mcp,
        )


class CreateScenariosSqlRow(BaseModel):
    """SQL row returned from creating a scenarios_resource."""

    scenarios_resource_id: UUID | None = None


async def create_scenarios_internal(
    conn: asyncpg.Connection,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    persona_ids: list[UUID] | None = None,
    parameter_field_ids: list[UUID] | None = None,
    document_ids: list[UUID] | None = None,
    objective_ids: list[UUID] | None = None,
    image_ids: list[UUID] | None = None,
    video_ids: list[UUID] | None = None,
    question_ids: list[UUID] | None = None,
    option_ids: list[UUID] | None = None,
    problem_statement_ids: list[UUID] | None = None,
    problem_statement_enabled: bool = True,
    objectives_enabled: bool = True,
    video_enabled: bool = False,
    images_enabled: bool = False,
    questions_enabled: bool = False,
    mcp: bool = False,
) -> UUID:
    """Create a denormalized scenarios_resource and return its ID.

    Looks up actual values from the referenced resource tables
    (names_resource.name, descriptions_resource.description) and
    stores a flattened snapshot in scenarios_resource.
    """
    params = CreateScenariosSqlParams(
        name_id=name_id,
        description_id=description_id,
        department_ids=department_ids,
        persona_ids=persona_ids,
        parameter_field_ids=parameter_field_ids,
        document_ids=document_ids,
        objective_ids=objective_ids,
        image_ids=image_ids,
        video_ids=video_ids,
        question_ids=question_ids,
        option_ids=option_ids,
        problem_statement_ids=problem_statement_ids,
        problem_statement_enabled=problem_statement_enabled,
        objectives_enabled=objectives_enabled,
        video_enabled=video_enabled,
        images_enabled=images_enabled,
        questions_enabled=questions_enabled,
        mcp=mcp,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    if not result or not result.scenarios_resource_id:
        raise ValueError("Failed to create scenarios resource")

    await invalidate_tags(["resources", "scenarios"])
    return result.scenarios_resource_id
