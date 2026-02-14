"""Typed event models for auth_item_keys resource generation."""

from typing import Any

from pydantic import BaseModel


class AuthItemKeysGenerationCompleteEvent(BaseModel):
    """Server-to-client event: auth_item_keys_generation_complete."""

    artifact_type: str
    resource_type: str = "auth_item_keys"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
