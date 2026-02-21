"""Types for home artifact endpoint."""

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.artifacts.chat.types import (
    ChatSimulationOperational,
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
)
from app.api.v4.artifacts.types import HistoryResponse
from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.sql.types import (
    QGetAgentsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetDepartmentsV4Item,
    QGetDocumentsV4Item,
    QGetImagesV4Item,
    QGetModelsV4Item,
    QGetObjectivesV4Item,
    QGetOptionsV4Item,
    QGetParameterFieldsV4Item,
    QGetParametersV4Item,
    QGetPersonasV4Item,
    QGetProblemStatementsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetQuestionsV4Item,
    QGetScenariosV4Item,
    QGetToolsV4Item,
    QGetTrainingDraftsEntriesV4Item,
    QGetVideosV4Item,
)

# =============================================================================
# Websocket types
# =============================================================================


class HomeWebsocketViews(BaseModel):
    """Draft view for home bundle websocket consumers."""

    draft_training: QGetTrainingDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class HomeWebsocketResources(BaseModel):
    """Hydrated resources for home bundle websocket — selected only."""

    # 12 domain resources
    departments: list[QGetDepartmentsV4Item] | None = None
    personas: list[QGetPersonasV4Item] | None = None
    documents: list[QGetDocumentsV4Item] | None = None
    parameter_fields: list[QGetParameterFieldsV4Item] | None = None
    scenarios: list[QGetScenariosV4Item] | None = None
    parameters: list[QGetParametersV4Item] | None = None
    questions: list[QGetQuestionsV4Item] | None = None
    options: list[QGetOptionsV4Item] | None = None
    videos: list[QGetVideosV4Item] | None = None
    images: list[QGetImagesV4Item] | None = None
    problem_statements: list[QGetProblemStatementsV4Item] | None = None
    objectives: list[QGetObjectivesV4Item] | None = None
    # Config chain
    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None
    config_args: list[QGetArgsV4Item] | None = None
    config_args_outputs: list[QGetArgsOutputsV4Item] | None = None
    config_profile: list[QGetProfilesV4Item] | None = None


class GetHomeWebsocketResponse(BaseModel):
    """Websocket-facing home bundle response with hydrated resources."""

    views: HomeWebsocketViews | None = None
    resources: HomeWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


# =============================================================================
# GET endpoint types
# =============================================================================


class GetHomeRequest(BaseModel):
    """Request for home get endpoint with optional history."""

    history_enabled: bool = False
    history_sort_by: str | None = "date"
    history_sort_order: str | None = "desc"
    history_page: int = 0
    history_page_size: int = 20
    history_simulation_search: str | None = None
    history_scenario_search: str | None = None
    history_show_archived: bool = False
    history_scenario_ids: list[UUID] | None = None
    history_infinite_mode: bool | None = None


class GetHomeResponse(BaseModel):
    """Client-facing API response for home get (operational).

    Returns simulations user can take, scoped by their cohorts.
    """

    actor_name: str | None = None
    items: list[ChatSimulationOperational] | None = None
    rubrics: list[RubricMapping] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None
    history: HistoryResponse | None = None
