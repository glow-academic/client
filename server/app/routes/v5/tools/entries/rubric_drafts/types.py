"""Rubric drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateRubricDraftResponse(BaseModel):
    id: UUID


class GetRubricDraftResponse(BaseModel):
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
    flag_ids: list[UUID]
    name_ids: list[UUID]
    point_ids: list[UUID]
    profile_ids: list[UUID]
    standard_group_ids: list[UUID]
    standard_ids: list[UUID]
