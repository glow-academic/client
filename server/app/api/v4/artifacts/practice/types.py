"""Types for practice artifact endpoint."""

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.artifacts.chat.types import (
    ChatSimulationOperational,
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
)
from app.api.v4.artifacts.types import HistoryResponse, WebsocketConfig
from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDocumentsV4Item,
    QGetImagesV4Item,
    QGetObjectivesV4Item,
    QGetOptionsV4Item,
    QGetParameterFieldsV4Item,
    QGetParametersV4Item,
    QGetPersonasV4Item,
    QGetProblemStatementsV4Item,
    QGetQuestionsV4Item,
    QGetScenariosV4Item,
    QGetTrainingDraftsEntriesV4Item,
    QGetVideosV4Item,
)

# =============================================================================
# Websocket types
# =============================================================================


class PracticeWebsocketEntries(BaseModel):
    """Draft entries for practice bundle websocket consumers."""

    draft_training: QGetTrainingDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class PracticeWebsocketResources(BaseModel):
    """Hydrated resources for practice bundle websocket — selected only."""

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


class GetPracticeWebsocketResponse(BaseModel):
    """Websocket-facing practice bundle response with hydrated resources."""

    entries: PracticeWebsocketEntries | None = None
    resources: PracticeWebsocketResources
    config: WebsocketConfig | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


# =============================================================================
# GET endpoint types
# =============================================================================


class GetPracticeRequest(BaseModel):
    """Request for practice get endpoint with optional history."""

    history_sort_by: str | None = "date"
    history_sort_order: str | None = "desc"
    history_page: int = 0
    history_page_size: int = 20
    history_simulation_search: str | None = None
    history_scenario_search: str | None = None
    history_show_archived: bool = False
    history_scenario_ids: list[UUID] | None = None
    history_infinite_mode: bool | None = None


class GetPracticeResponse(BaseModel):
    """Client-facing API response for practice get (operational).

    Returns practice simulations user can take, scoped by their cohorts.
    """

    actor_name: str | None = None
    items: list[ChatSimulationOperational] | None = None
    rubrics: list[RubricMapping] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None
    history: HistoryResponse | None = None
