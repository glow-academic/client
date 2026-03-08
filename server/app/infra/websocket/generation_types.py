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


# ═══════════════════════════════════════════════════════════════════════════
# Generate gate types — moved from routes/v5/socket/ to avoid import chain
# ═══════════════════════════════════════════════════════════════════════════


class GenerateErrorApiRequest(BaseModel):
    """Payload for generate_*_error events (internal server-to-server).

    Used for internal error propagation with socket ID for routing.
    """

    sid: str
    error_message: str
    artifact_type: str | None = None
    group_id: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None


from typing import Literal

from pydantic import model_validator

ArtifactOperation = Literal[
    "get", "list", "duplicate", "delete", "draft", "save", "docs", "export", "refresh"
]
ResourceOperation = Literal["get", "create", "link", "search", "docs"]
EntryOperation = Literal["get", "search", "docs", "create", "refresh"]


class ArtifactTypeItem(BaseModel):
    """Typed artifact operation reference."""

    name: str
    operation: ArtifactOperation


class ResourceTypeItem(BaseModel):
    """Typed resource operation reference."""

    name: str
    operation: ResourceOperation


class EntryTypeItem(BaseModel):
    """Typed entry operation reference."""

    name: str
    operation: EntryOperation


class GeneratePayload(BaseModel):
    """Unified client-to-server payload for the `generate` WebSocket event."""

    artifact_types: list[ArtifactTypeItem]
    artifact_id: Any | None = None
    draft_id: Any | None = None
    resource_types: list[ResourceTypeItem]
    entry_types: list[EntryTypeItem] | None = None

    @model_validator(mode="before")
    @classmethod
    def _coerce_resource_types(cls, data: Any) -> Any:
        """Auto-coerce plain strings to ResourceTypeItem for backward compatibility."""
        if isinstance(data, dict):
            raw = data.get("resource_types")
            if isinstance(raw, list):
                data["resource_types"] = [
                    {"name": item, "operation": "create"}
                    if isinstance(item, str)
                    else item
                    for item in raw
                ]
        return data

    @property
    def artifact_type(self) -> str:
        """Derived primary artifact type — the name of the first artifact_types entry."""
        return self.artifact_types[0].name if self.artifact_types else "unknown"

    user_instructions: list[str] | None = None
    save: bool = False
    run_id: str | None = None
    group_id: str | None = None
    modality: str = "call"
    extra_messages: list[dict[str, str]] | None = None
    metadata: dict[str, Any] | None = None
