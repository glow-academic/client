"""Field drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateFieldDraftResponse(BaseModel):
    id: UUID


class GetFieldDraftResponse(BaseModel):
    id: UUID
    version: int
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    group_id: UUID
    session_id: UUID
    conditional_parameter_ids: list[UUID]
    department_ids: list[UUID]
    description_ids: list[UUID]
    flag_ids: list[UUID]
    name_ids: list[UUID]
    profile_ids: list[UUID]
