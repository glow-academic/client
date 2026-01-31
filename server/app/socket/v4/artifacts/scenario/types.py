"""WebSocket-specific types for scenario generation.

Extends base artifact types with scenario-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.scenario.types import GetScenarioApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetDocumentsV4Item,
    QGetImagesV4Item,
    QGetNamesV4Item,
    QGetObjectivesV4Item,
    QGetParameterFieldsV4Item,
    QGetParametersV4Item,
    QGetPersonasV4Item,
    QGetProblemStatementsV4Item,
    QGetQuestionsV4Item,
    QGetTemplatesV4Item,
    QGetVideosV4Item,
)


# =============================================================================
# Client-to-Server Events (scenario_generate)
# =============================================================================


class GenerateScenarioPayload(GetScenarioApiRequest):
    """Request payload for scenario_generate WebSocket event.

    Extends GetScenarioApiRequest (which has scenario_id, draft_id, search terms)
    with generation-specific fields and form state.
    """

    # Generation-specific fields
    agent_id: UUID  # Required: explicit agent ID from frontend
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions

    # Form state fields for "current" variable in Jinja templates
    # These represent the currently selected resources in the form
    name_id: UUID | None = None
    description_id: UUID | None = None
    problem_statement_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    template_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ScenarioGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: scenario_generation_complete.

    Emitted when a scenario resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "scenario"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    problem_statement_resource: QGetProblemStatementsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    department_resources: list[QGetDepartmentsV4Item] | None = None
    persona_resources: list[QGetPersonasV4Item] | None = None
    document_resources: list[QGetDocumentsV4Item] | None = None
    template_resources: list[QGetTemplatesV4Item] | None = None
    objective_resources: list[QGetObjectivesV4Item] | None = None
    question_resources: list[QGetQuestionsV4Item] | None = None
    image_resources: list[QGetImagesV4Item] | None = None
    video_resources: list[QGetVideosV4Item] | None = None
    parameter_resources: list[QGetParametersV4Item] | None = None
    parameter_field_resources: list[QGetParameterFieldsV4Item] | None = None


class ScenarioGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: scenario_generation_progress.

    Emitted during scenario resource generation to show progress.
    """

    artifact_type: str = "scenario"


class ScenarioGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: scenario_generation_error.

    Emitted when scenario resource generation fails.
    """

    artifact_type: str = "scenario"
