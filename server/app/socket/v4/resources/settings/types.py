"""Typed event models for settings resource socket events."""

from typing import Any

from pydantic import BaseModel

from app.sql.types import QGetSettingsV4Auth


class SettingsGenerationStartedEvent(BaseModel):
    """Server-to-client event: settings_generation_started."""

    artifact_type: str
    resource_type: str = "settings"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class SettingsGenerationProgressEvent(BaseModel):
    """Server-to-client event: settings_generation_progress."""

    artifact_type: str
    resource_type: str = "settings"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class SettingsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: settings_generation_complete."""

    artifact_type: str
    resource_type: str = "settings"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    settings_id: str | None = None
    created_at: str | None = None
    active: bool | None = None
    name: str | None = None
    description: str | None = None
    primary_color: str | None = None
    accent: str | None = None
    background: str | None = None
    surface: str | None = None
    success: str | None = None
    warning: str | None = None
    error: str | None = None
    sidebar_background: str | None = None
    sidebar_primary: str | None = None
    chart1: str | None = None
    chart2: str | None = None
    chart3: str | None = None
    chart4: str | None = None
    chart5: str | None = None
    guest_login_enabled: bool | None = None
    success_threshold: int | None = None
    warning_threshold: int | None = None
    danger_threshold: int | None = None
    auth_ids: list[str] | None = None
    auths: list[QGetSettingsV4Auth] | None = None
    provider_key_ids: list[str] | None = None


class SettingsGenerationErrorEvent(BaseModel):
    """Server-to-client event: settings_generation_error."""

    artifact_type: str
    resource_type: str = "settings"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
