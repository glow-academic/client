"""Artifact socket payload types.

Contains base event classes for artifact generation that artifact-specific
types can extend. Also contains internal server-to-server event types.
"""

from typing import Any

from pydantic import BaseModel

# =============================================================================
# Base Server-to-Client Events
# =============================================================================


class GenerationProgressEvent(BaseModel):
    """Base server-to-client event for generation progress.

    Artifact-specific progress events should extend this class
    and set a default artifact_type value.
    """

    artifact_type: str
    group_id: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    run_id: str | None = None
    modality: str | None = None  # "call", "text"
    type: str | None = None  # "start", "progress"
    event_type: str | None = None  # "tool_call_start", "tool_call_delta", etc.
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments: dict[str, Any] | None = None
    arguments_delta: str | None = None
    trace_id: str | None = None


class GenerationErrorEvent(BaseModel):
    """Base server-to-client event for generation errors.

    Artifact-specific error events should extend this class
    and set a default artifact_type value.
    """

    artifact_type: str
    group_id: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str
    trace_id: str | None = None


class GenerationCompleteEvent(BaseModel):
    """Base server-to-client event for generation completion.

    Artifact-specific complete events should extend this class
    and set a default artifact_type value.
    """

    artifact_type: str
    group_id: str
    resource_type: str
    run_id: str | None = None
    success: bool
    message: str
    type: str | None = None


# =============================================================================
# Internal Server-to-Server Events
# =============================================================================


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


# =============================================================================
# Shared Server-to-Client Events (cross-artifact)
# =============================================================================


class PersonaGenerationStartedEvent(BaseModel):
    """Server-to-client event: persona_generation_started.

    Emitted when persona generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "persona"
    group_id: str
    run_id: str
    resource_types: list[str]
