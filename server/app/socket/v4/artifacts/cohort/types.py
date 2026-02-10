"""WebSocket-specific types for cohort generation."""

from app.api.v4.artifacts.cohort.types import (
    CohortDepartment,
    CohortDescriptionResource,
    CohortFlagResource,
    CohortNameResource,
    CohortSimulation,
    CohortSimulationPosition,
    GetCohortApiRequest,
)
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class GenerateCohortPayload(GetCohortApiRequest):
    """Client payload for cohort_generate event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None


class CohortGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client cohort_generation_complete event."""

    artifact_type: str = "cohort"
    name_resource: CohortNameResource | None = None
    description_resource: CohortDescriptionResource | None = None
    flag_resource: CohortFlagResource | None = None
    department_resources: list[CohortDepartment] | None = None
    simulation_resources: list[CohortSimulation] | None = None
    simulation_positions: list[CohortSimulationPosition] | None = None


class CohortGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client cohort_generation_progress event."""

    artifact_type: str = "cohort"


class CohortGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client cohort_generation_error event."""

    artifact_type: str = "cohort"
