"""Tool drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateToolDraftResponse(BaseModel):
    id: UUID


class GetToolDraftResponse(BaseModel):
    id: UUID
    version: int
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    group_id: UUID
    session_id: UUID
    arg_position_ids: list[UUID]
    arg_ids: list[UUID]
    args_output_ids: list[UUID]
    department_ids: list[UUID]
    description_ids: list[UUID]
    entry_ids: list[UUID]
    flag_ids: list[UUID]
    name_ids: list[UUID]
    profile_ids: list[UUID]
    resource_ids: list[UUID]
