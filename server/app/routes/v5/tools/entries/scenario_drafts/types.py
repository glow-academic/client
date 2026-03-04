"""Scenario drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateScenarioDraftResponse(BaseModel):
    id: UUID


class GetScenarioDraftResponse(BaseModel):
    id: UUID
    version: int
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    group_id: UUID
    session_id: UUID
    department_ids: list[UUID]
    description_ids: list[UUID]
    document_ids: list[UUID]
    flag_ids: list[UUID]
    image_ids: list[UUID]
    name_ids: list[UUID]
    objective_ids: list[UUID]
    option_ids: list[UUID]
    parameter_field_ids: list[UUID]
    persona_ids: list[UUID]
    problem_statement_ids: list[UUID]
    profile_ids: list[UUID]
    question_ids: list[UUID]
    video_ids: list[UUID]
