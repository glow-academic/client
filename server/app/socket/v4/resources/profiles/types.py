"""Typed event models for profiles resource generation."""

from typing import Any

from pydantic import BaseModel


class ProfilesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: profiles_generation_complete."""

    artifact_type: str
    resource_type: str = "profiles"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
