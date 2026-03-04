"""Model drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateModelDraftResponse(BaseModel):
    id: UUID


class GetModelDraftResponse(BaseModel):
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
    modality_ids: list[UUID]
    name_ids: list[UUID]
    pricing_ids: list[UUID]
    profile_ids: list[UUID]
    provider_ids: list[UUID]
    quality_ids: list[UUID]
    reasoning_level_ids: list[UUID]
    temperature_level_ids: list[UUID]
    value_ids: list[UUID]
    voice_ids: list[UUID]
