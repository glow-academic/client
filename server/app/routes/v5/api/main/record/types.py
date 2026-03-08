"""Types for record artifact."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse

# =============================================================================
# HTTP Client Types
# =============================================================================


class RecordRequest(BaseModel):
    """Request for record profile report — dashboard scoped to one profile."""

    target_profile_id: UUID

    # Global filters
    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    simulation_filters: list[str] | None = None
    actor_profile_id: UUID | None = None

    # Section pickers
    rubric_ids: list[UUID] | None = None
    rubric_search: str | None = None
    simulation_picker_ids: list[UUID] | None = None
    simulation_picker_search: str | None = None
    parameter_ids: list[UUID] | None = None
    parameter_search: str | None = None
    scenario_ids: list[UUID] | None = None
    scenario_search: str | None = None

    # History section (inline in /get for backward compat)
    history_practice: bool = False
    history_scenario_ids: list[UUID] | None = None
    history_infinite_mode: bool | None = None
    history_show_archived: bool = False
    history_sort_by: str | None = "date"
    history_sort_order: str | None = "desc"
    history_page: int = 0
    history_page_size: int = 20
    history_simulation_search: str | None = None
    history_scenario_search: str | None = None
    history_profile_search: str | None = None


class ListRecordRequest(BaseModel):
    """Request for record history list endpoint (paginated attempt history)."""

    target_profile_id: UUID

    # Global filters
    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None

    # History-specific
    practice: bool = False
    scenario_ids: list[UUID] | None = None
    infinite_mode: bool | None = None
    show_archived: bool = False
    sort_by: str = "date"
    sort_order: str = "desc"
    page: int = 0
    page_size: int = 20
    simulation_search: str | None = None
    scenario_search: str | None = None


# =============================================================================
# WebSocket Types
# =============================================================================


class GetRecordApiRequest(BaseModel):
    """Request model for get record endpoint."""

    record_id: UUID | None = None
    draft_id: UUID | None = None


class RecordWebsocketEntries(BaseModel):
    """Entries data for record websocket response."""

    runs: GetRunListViewResponse | None = None


class RecordWebsocketResources(BaseModel):
    """Hydrated resources for record websocket — selected only."""

    pass


class GetRecordWebsocketResponse(BaseModel):
    """Websocket-facing record response with hydrated resources.

    Uses Any for config chain fields to accept both compiled SQL types
    and resource fetcher types during migration.
    """

    systems: list[Any] | None = None
    agents: list[Any] | None = None
    models: list[Any] | None = None
    providers: list[Any] | None = None
    tools: list[Any] | None = None
    args: list[Any] | None = None
    args_outputs: list[Any] | None = None
    profile: list[Any] | None = None
    params: BaseModel | None = None
    resource_system_ids: dict[str, UUID | None] | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
    entries: RecordWebsocketEntries | None = None
    resources: RecordWebsocketResources
