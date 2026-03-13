"""Types for record artifact."""

from uuid import UUID

from pydantic import BaseModel


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
# Export endpoint types
# =============================================================================


class ExportRecordApiResponse(BaseModel):
    """Response model for record export."""

    content: str
    file_name: str
    mime_type: str
    row_count: int
