"""Handcrafted request models for settings artifact migration."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GetSettingApiRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    setting_id: UUID | None = Field(default=None, alias="settings_id")
    color_search: str | None = None
    draft_id: UUID | None = None
    mcp: bool | None = False


class SettingResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SettingMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveSettingApiRequest(BaseModel):
    input_setting_id: UUID | None = None
    group_id: UUID | None = None
    names: SettingResourceAction
    descriptions: SettingResourceAction
    colors: SettingMultiResourceAction
    flags: SettingResourceAction
    departments: SettingMultiResourceAction
    profiles: SettingMultiResourceAction
    auths: SettingMultiResourceAction
    provider_keys: SettingMultiResourceAction
    auth_item_keys: SettingMultiResourceAction
    roles: SettingMultiResourceAction
    role_routes: SettingMultiResourceAction


class PatchSettingDraftApiRequest(BaseModel):
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: SettingResourceAction | None = None
    descriptions: SettingResourceAction | None = None
    colors: SettingMultiResourceAction | None = None
    flags: SettingResourceAction | None = None
    departments: SettingMultiResourceAction | None = None
    profiles: SettingMultiResourceAction | None = None
    auths: SettingMultiResourceAction | None = None
    provider_keys: SettingMultiResourceAction | None = None
    auth_item_keys: SettingMultiResourceAction | None = None
    roles: SettingMultiResourceAction | None = None
    role_routes: SettingMultiResourceAction | None = None
    expected_version: int = 0


# ========== List Endpoint Types ==========


class ListSettingApiSetting(BaseModel):
    settings_id: UUID | None = None
    created_at: datetime | None = None
    active: bool | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None


class ListSettingApiKey(BaseModel):
    key_id: UUID | None = None
    name: str | None = None
    key_masked: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None


class ListSettingApiResponse(BaseModel):
    actor_name: str | None = None
    user_role: str | None = None
    settings: list[ListSettingApiSetting] | None = None
    keys: list[ListSettingApiKey] | None = None


# ========== Delete Endpoint Types ==========


class DeleteSettingApiRequest(BaseModel):
    setting_id: UUID


class DeleteSettingApiResponse(BaseModel):
    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateSettingApiRequest(BaseModel):
    setting_id: UUID


class DuplicateSettingApiResponse(BaseModel):
    success: bool
    setting_id: UUID
    message: str
