"""Auth drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateAuthDraftResponse(BaseModel):
    id: UUID


class GetAuthDraftResponse(BaseModel):
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
    item_ids: list[UUID]
    name_ids: list[UUID]
    profile_ids: list[UUID]
    protocol_ids: list[UUID]
    slug_ids: list[UUID]
