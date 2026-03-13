"""Department drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateDepartmentDraftResponse(BaseModel):
    id: UUID


class GetDepartmentDraftResponse(BaseModel):
    id: UUID
    version: int
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    group_id: UUID
    session_id: UUID
    description_ids: list[UUID]
    flag_ids: list[UUID]
    name_ids: list[UUID]
    profile_ids: list[UUID]
    setting_ids: list[UUID]
