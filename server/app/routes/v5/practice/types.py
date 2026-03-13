"""Types for practice artifact endpoint."""

from uuid import UUID

from pydantic import BaseModel

from app.infra.auth.types import AnalyticsFacets
from app.routes.v5.chat.types import (
    ChatSimulationOperational,
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
)
from app.infra.v5_types import HistoryResponse

# =============================================================================
# Export Types
# =============================================================================


class ExportPracticeApiResponse(BaseModel):
    """Response model for practice export."""

    content: str
    file_name: str
    mime_type: str
    row_count: int


# =============================================================================
# GET endpoint types
# =============================================================================


class GetPracticeRequest(BaseModel):
    """Request for practice get endpoint — simulation cards only."""

    pass


class GetPracticeResponse(BaseModel):
    """Client-facing API response for practice get (operational).

    Returns practice simulations user can take, scoped by their cohorts.
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


class ListPracticeRequest(BaseModel):
    """Request for practice list endpoint — paginated attempt history."""

    sort_by: str | None = "date"
    sort_order: str | None = "desc"
    page: int = 0
    page_size: int = 20
    simulation_search: str | None = None
    scenario_search: str | None = None
    show_archived: bool = False
    scenario_ids: list[UUID] | None = None
    infinite_mode: bool | None = None


class ListPracticeResponse(HistoryResponse):
    """Client-facing API response for practice list (paginated history)."""

    pass
