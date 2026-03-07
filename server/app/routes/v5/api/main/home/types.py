"""Types for home artifact endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.main.chat.types import (
    ChatSimulationOperational,
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
)
from app.routes.v5.api.main.types import HistoryResponse, InternalResponseBase
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse

# =============================================================================
# Export Types
# =============================================================================


class ExportHomeApiResponse(BaseModel):
    """Response model for home certificate export."""

    upload_id: UUID
    file_name: str
    row_count: int


# =============================================================================
# Websocket types
# =============================================================================


class HomeWebsocketEntries(BaseModel):
    """Draft entries for home bundle websocket consumers."""

    draft_training: Any | None = None
    runs: GetRunListViewResponse | None = None


class HomeWebsocketResources(BaseModel):
    """Hydrated resources for home bundle websocket — selected only."""

    # 12 domain resources
    departments: list[Any] | None = None
    personas: list[Any] | None = None
    documents: list[Any] | None = None
    parameter_fields: list[Any] | None = None
    scenarios: list[Any] | None = None
    parameters: list[Any] | None = None
    questions: list[Any] | None = None
    options: list[Any] | None = None
    videos: list[Any] | None = None
    images: list[Any] | None = None
    problem_statements: list[Any] | None = None
    objectives: list[Any] | None = None


class GetHomeWebsocketResponse(InternalResponseBase):
    """Websocket-facing home bundle response with hydrated resources."""

    entries: HomeWebsocketEntries | None = None
    resources: HomeWebsocketResources


# =============================================================================
# GET endpoint types
# =============================================================================


class GetHomeRequest(BaseModel):
    """Request for home get endpoint — simulation cards only."""

    pass


class GetHomeResponse(BaseModel):
    """Client-facing API response for home get (operational).

    Returns simulations user can take, scoped by their cohorts.
    """

    actor_name: str | None = None
    items: list[ChatSimulationOperational] | None = None
    rubrics: list[RubricMapping] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None


# =============================================================================
# LIST endpoint types (paginated history)
# =============================================================================


class ListHomeRequest(BaseModel):
    """Request for home list endpoint — paginated attempt history."""

    sort_by: str | None = "date"
    sort_order: str | None = "desc"
    page: int = 0
    page_size: int = 20
    simulation_search: str | None = None
    scenario_search: str | None = None
    scenario_ids: list[UUID] | None = None
    infinite_mode: bool | None = None


class ListHomeResponse(HistoryResponse):
    """Client-facing API response for home list (paginated history)."""

    pass
