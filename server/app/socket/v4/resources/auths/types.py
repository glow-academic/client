"""Typed event models for auths resource generation."""

from typing import Any

from pydantic import BaseModel


class AuthsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: auths_generation_complete."""

    artifact_type: str
    resource_type: str = "auths"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
