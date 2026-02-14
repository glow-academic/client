"""Typed event models for provider_keys resource socket events."""

from typing import Any

from pydantic import BaseModel


class ProviderKeysGenerationStartedEvent(BaseModel):
    """Server-to-client event: provider_keys_generation_started."""

    artifact_type: str
    resource_type: str = "provider_keys"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ProviderKeysGenerationProgressEvent(BaseModel):
    """Server-to-client event: provider_keys_generation_progress."""

    artifact_type: str
    resource_type: str = "provider_keys"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ProviderKeysGenerationCompleteEvent(BaseModel):
    """Server-to-client event: provider_keys_generation_complete."""

    artifact_type: str
    resource_type: str = "provider_keys"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    provider_id: str | None = None
    key_id: str | None = None
    provider_name: str | None = None
    key_name: str | None = None
    key_description: str | None = None
    active: bool | None = None
    generated: bool | None = None


class ProviderKeysGenerationErrorEvent(BaseModel):
    """Server-to-client event: provider_keys_generation_error."""

    artifact_type: str
    resource_type: str = "provider_keys"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
