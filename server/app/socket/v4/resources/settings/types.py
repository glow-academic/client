"""Typed event models for settings resource generation."""

from typing import Any

from pydantic import BaseModel


class SettingsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: settings_generation_complete."""

    artifact_type: str
    resource_type: str = "settings"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
