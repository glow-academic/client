"""Handcrafted request models for settings artifact migration."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GetSettingApiRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    setting_id: UUID | None = Field(default=None, alias="settings_id")
    color_search: str | None = None
    draft_id: UUID | None = None
    mcp: bool | None = False


class SaveSettingApiRequest(BaseModel):
    input_setting_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    color_ids: list[UUID]
    active_flag_id: UUID | None = None
    department_ids: list[UUID]
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_key_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None
    role_route_ids: list[UUID] | None = None


class PatchSettingDraftApiRequest(BaseModel):
    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    color_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_key_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None
    role_route_ids: list[UUID] | None = None
    expected_version: int = 0
