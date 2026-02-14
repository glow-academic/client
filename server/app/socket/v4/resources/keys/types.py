"""Typed event models for keys resource generation."""

from typing import Any

from pydantic import BaseModel


class KeysGenerationCompleteEvent(BaseModel):
    """Server-to-client event: keys_generation_complete."""

    artifact_type: str
    resource_type: str = "keys"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
