"""Typed event models for auth_item_keys resource socket events."""

from typing import Any

from pydantic import BaseModel


class AuthItemKeysGenerationStartedEvent(BaseModel):
    """Server-to-client event: auth_item_keys_generation_started."""

    artifact_type: str
    resource_type: str = "auth_item_keys"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class AuthItemKeysGenerationProgressEvent(BaseModel):
    """Server-to-client event: auth_item_keys_generation_progress."""

    artifact_type: str
    resource_type: str = "auth_item_keys"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class AuthItemKeysGenerationCompleteEvent(BaseModel):
    """Server-to-client event: auth_item_keys_generation_complete."""

    artifact_type: str
    resource_type: str = "auth_item_keys"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    auth_id: str | None = None
    item_id: str | None = None
    key_id: str | None = None
    auth_name: str | None = None
    key_name: str | None = None
    key_description: str | None = None
    active: bool | None = None
    generated: bool | None = None


class AuthItemKeysGenerationErrorEvent(BaseModel):
    """Server-to-client event: auth_item_keys_generation_error."""

    artifact_type: str
    resource_type: str = "auth_item_keys"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
