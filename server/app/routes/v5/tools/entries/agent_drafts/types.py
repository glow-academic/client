"""Agent drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateAgentDraftResponse(BaseModel):
    id: UUID


class GetAgentDraftResponse(BaseModel):
    id: UUID
    version: int
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    group_id: UUID
    session_id: UUID
    name_ids: list[UUID]
    description_ids: list[UUID]
    flag_ids: list[UUID]
    department_ids: list[UUID]
    model_ids: list[UUID]
    tool_ids: list[UUID]
    profile_ids: list[UUID]
    reasoning_level_ids: list[UUID]
    temperature_level_ids: list[UUID]
    voice_ids: list[UUID]
    quality_ids: list[UUID]
    rubric_ids: list[UUID] = []
