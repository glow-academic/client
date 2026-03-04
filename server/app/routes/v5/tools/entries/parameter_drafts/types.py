"""Parameter drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateParameterDraftResponse(BaseModel):
    id: UUID


class GetParameterDraftResponse(BaseModel):
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
    field_ids: list[UUID]
    flag_ids: list[UUID]
    name_ids: list[UUID]
    profile_ids: list[UUID]
