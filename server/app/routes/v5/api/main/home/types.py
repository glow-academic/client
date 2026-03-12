"""Types for home artifact endpoint."""

from uuid import UUID

from pydantic import BaseModel

from app.routes.auth.types import AnalyticsFacets
from app.routes.v5.api.main.chat.types import (
    ChatSimulationOperational,
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
)
from app.routes.v5.api.main.types import HistoryResponse

# =============================================================================
# Export Types
# =============================================================================


class ExportHomeApiResponse(BaseModel):
    """Response model for home certificate export."""

    content: str
    file_name: str
    mime_type: str
    row_count: int


# =============================================================================
# GET endpoint types
# =============================================================================


class GetHomeRequest(BaseModel):
    """Request for home get endpoint — simulation cards only."""

    pass


class GetHomeResponse(BaseModel):
    """Client-facing API response for home get (operational).

    Returns simulations user can take, scoped by their cohorts.
    Includes inline analytics facets for SSR filter rendering.
    """

    actor_name: str | None = None
    items: list[ChatSimulationOperational] | None = None
    rubrics: list[RubricMapping] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None
    analytics: AnalyticsFacets | None = None


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
