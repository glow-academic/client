"""Typed event models for provider_keys resource generation."""

from typing import Any

from pydantic import BaseModel


class ProviderKeysGenerationCompleteEvent(BaseModel):
    """Server-to-client event: provider_keys_generation_complete."""

    artifact_type: str
    resource_type: str = "provider_keys"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
