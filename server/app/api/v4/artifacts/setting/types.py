"""Handcrafted request models for settings artifact migration."""

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
