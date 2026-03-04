"""Setting drafts entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateSettingDraftResponse(BaseModel):
    id: UUID


class GetSettingDraftResponse(BaseModel):
    id: UUID
    version: int
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    group_id: UUID
    session_id: UUID
    agent_ids: list[UUID]
    auth_item_key_ids: list[UUID]
    auth_ids: list[UUID]
    color_ids: list[UUID]
    department_ids: list[UUID]
    description_ids: list[UUID]
    flag_ids: list[UUID]
    item_ids: list[UUID]
    name_ids: list[UUID]
    profile_ids: list[UUID]
    provider_key_ids: list[UUID]
    threshold_ids: list[UUID]
