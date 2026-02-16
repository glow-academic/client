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
    resolved_fields: dict[str, Any] | None = None
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


class ScenarioGenerationStartedEvent(BaseModel):
    """Server-to-client event: scenario_generation_started.

    Emitted when scenario generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "scenario"
    group_id: str
    run_id: str
    resource_types: list[str]


class SimulationGenerationStartedEvent(BaseModel):
    """Server-to-client event: simulation_generation_started.

    Emitted when simulation generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "simulation"
    group_id: str
    run_id: str
    resource_types: list[str]


class CohortGenerationStartedEvent(BaseModel):
    """Server-to-client event: cohort_generation_started.

    Emitted when cohort generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "cohort"
    group_id: str
    run_id: str
    resource_types: list[str]


class DocumentGenerationStartedEvent(BaseModel):
    """Server-to-client event: document_generation_started.

    Emitted when document generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "document"
    group_id: str
    run_id: str
    resource_types: list[str]


class ProfileGenerationStartedEvent(BaseModel):
    """Server-to-client event: profile_generation_started.

    Emitted when profile generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "profile"
    group_id: str
    run_id: str
    resource_types: list[str]


class ParameterGenerationStartedEvent(BaseModel):
    """Server-to-client event: parameter_generation_started.

    Emitted when parameter generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "parameter"
    group_id: str
    run_id: str
    resource_types: list[str]


class FieldGenerationStartedEvent(BaseModel):
    """Server-to-client event: field_generation_started.

    Emitted when field generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "field"
    group_id: str
    run_id: str
    resource_types: list[str]


class AgentGenerationStartedEvent(BaseModel):
    """Server-to-client event: agent_generation_started.

    Emitted when agent generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "agent"
    group_id: str
    run_id: str
    resource_types: list[str]


class ModelGenerationStartedEvent(BaseModel):
    """Server-to-client event: model_generation_started.

    Emitted when model generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "model"
    group_id: str
    run_id: str
    resource_types: list[str]


class ProviderGenerationStartedEvent(BaseModel):
    """Server-to-client event: provider_generation_started.

    Emitted when provider generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "provider"
    group_id: str
    run_id: str
    resource_types: list[str]


class ToolGenerationStartedEvent(BaseModel):
    """Server-to-client event: tool_generation_started.

    Emitted when tool generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "tool"
    group_id: str
    run_id: str
    resource_types: list[str]


class DepartmentGenerationStartedEvent(BaseModel):
    """Server-to-client event: department_generation_started.

    Emitted when department generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "department"
    group_id: str
    run_id: str
    resource_types: list[str]


class RubricGenerationStartedEvent(BaseModel):
    """Server-to-client event: rubric_generation_started.

    Emitted when rubric generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "rubric"
    group_id: str
    run_id: str
    resource_types: list[str]


class EvalGenerationStartedEvent(BaseModel):
    """Server-to-client event: eval_generation_started.

    Emitted when eval generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "eval"
    group_id: str
    run_id: str
    resource_types: list[str]


class AuthGenerationStartedEvent(BaseModel):
    """Server-to-client event: auth_generation_started.

    Emitted when auth generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "auth"
    group_id: str
    run_id: str
    resource_types: list[str]


class SettingGenerationStartedEvent(BaseModel):
    """Server-to-client event: setting_generation_started.

    Emitted when setting generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "setting"
    group_id: str
    run_id: str
    resource_types: list[str]


class TrainingGenerationStartedEvent(BaseModel):
    """Server-to-client event: training_generation_started.

    Emitted when training generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "training"
    group_id: str
    run_id: str
    resource_types: list[str]


class BenchmarkBundleGenerationStartedEvent(BaseModel):
    """Server-to-client event: benchmark_bundle_generation_started.

    Emitted when benchmark bundle generation begins, listing which resource types
    will be generated.
    """

    artifact_type: str = "benchmark_bundle"
    group_id: str
    run_id: str
    resource_types: list[str]
