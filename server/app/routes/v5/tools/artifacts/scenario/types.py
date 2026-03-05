"""Scenario artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetScenariosResponse(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
    generated: bool
    mcp: bool
    active: bool
    # Junction IDs — None when not requested
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    problem_statement_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
