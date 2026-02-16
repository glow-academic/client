"""Canonical settings resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class SettingsResourceData(BaseModel):
    """Canonical settings resource fields. All optional for streaming support."""

    settings_id: str | None = None
    created_at: str | None = None
    active: bool | None = None
    name: str | None = None
    description: str | None = None
    primary_color: str | None = None
    accent: str | None = None
    background: str | None = None
    surface: str | None = None
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
    provider_key_ids: list[str] | None = None
