"""Setting artifact types — tool layer."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetSettingsResponse(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
    generated: bool
    mcp: bool
    active: bool
    # Junction IDs — None when not requested
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    color_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_item_keys_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    threshold_ids: list[UUID] | None = None
    systems_ids: list[UUID] | None = None
    setting_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    auth_item_value_ids: list[UUID] | None = None


class CreateSettingResponse(BaseModel):
    id: UUID


class UpdateSettingResponse(BaseModel):
    id: UUID
