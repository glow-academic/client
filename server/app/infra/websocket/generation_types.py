"""Pydantic models for generation-domain internal bus emits.

Each model represents a dict payload passed to ``internal_sio.emit()``.
Construct the model, then call ``.model_dump(mode="json")``
before sending via internal_sio.emit(..., model.model_dump(mode="json")).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class GenerationProgressData(BaseModel):
    type: str = "progress"
    sid: str
    artifact_type: str
    group_id: str
    run_id: str
    completed_resources: int
    total_resources: int
    percentage: int
    last_completed_resource: str


class GenerationSavedData(BaseModel):
    type: str = "saved"
    sid: str
    artifact_type: str
    group_id: str
    run_id: str
    artifact_id: str | None = None


class GenerationCompleteData(BaseModel):
    type: str = "complete"
    sid: str
    artifact_type: str
    group_id: str
    run_id: str
    success: bool
    message: str
    artifact_id: str | None = None
    resource_actions: dict[str, Any] | None = None


class GenerationErrorData(BaseModel):
    type: str = "error"
    sid: str
    artifact_type: str
    group_id: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str


class GenerationStartedData(BaseModel):
    sid: str
    artifact_type: str
    group_id: str
    run_id: str
    resource_types: list[str]


class GenerationStartedEvent(BaseModel):
    """Client-facing payload for server/generate/started.py."""

    artifact_type: str
    group_id: str
    run_id: str
    resource_types: list[str]
