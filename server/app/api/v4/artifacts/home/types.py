"""Types for home artifact endpoint."""

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.artifacts.chat.types import (
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
    TrainingSimulationOperational,
)
from app.api.v4.artifacts.types import HistoryResponse


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
    items: list[TrainingSimulationOperational] | None = None
    rubrics: list[RubricMapping] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None
    history: HistoryResponse | None = None
