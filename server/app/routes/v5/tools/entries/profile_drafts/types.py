"""Profile drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateProfileDraftResponse(BaseModel):
    id: UUID


class GetProfileDraftResponse(BaseModel):
    id: UUID
    version: int
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    group_id: UUID
    session_id: UUID
    department_ids: list[UUID]
    email_ids: list[UUID]
    flag_ids: list[UUID]
    name_ids: list[UUID]
    request_limit_ids: list[UUID]
    role_ids: list[UUID]
