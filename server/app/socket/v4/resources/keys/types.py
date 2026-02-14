"""Typed event models for keys resource socket events."""

from typing import Any

from pydantic import BaseModel


class KeysGenerationStartedEvent(BaseModel):
    """Server-to-client event: keys_generation_started."""

    artifact_type: str
    resource_type: str = "keys"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class KeysGenerationProgressEvent(BaseModel):
    """Server-to-client event: keys_generation_progress."""

    artifact_type: str
    resource_type: str = "keys"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class KeysGenerationCompleteEvent(BaseModel):
    """Server-to-client event: keys_generation_complete."""

    artifact_type: str
    resource_type: str = "keys"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    key_id: str | None = None
    key: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class KeysGenerationErrorEvent(BaseModel):
    """Server-to-client event: keys_generation_error."""

    artifact_type: str
    resource_type: str = "keys"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
