"""Types for unified chat view (mv_chats)."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatItem(BaseModel):
    """Single chat row from mv_chats.

    Unified type replacing ProfileFactsItem, SimulationFactsItem,
    ScenarioFactsItem, and ChatViewItem.
    """

    # Primary key
    chat_id: UUID

    # Foreign keys
    attempt_id: UUID
    group_id: UUID | None = None
    training_department_id: UUID | None = None

    # Resource IDs
    profile_id: UUID
    cohort_id: UUID | None = None
    department_id: UUID | None = None
    simulation_id: UUID
    scenario_id: UUID | None = None
    user_persona_id: UUID | None = None
    rubric_id: UUID | None = None

    # Grade measures (raw values — consumers compute grade_percent)
    grade_score: int | None = None
    grade_total_points: int | None = None
    grade_pass_points: int | None = None
    grade_passed: bool | None = None
    grade_time_taken: int | None = None

    # Chat state
    completed: bool = False
    attempt_number: int = 0

    # Timestamps
    chat_created_at: datetime | None = None
    attempt_date: date | None = None

    # Filters
    attempt_type: str | None = None  # 'general' | 'practice'
    is_archived: bool = False
    infinite_mode: bool = False

    # Enrichment fields (set by consumers after fetching, not from MV)
    num_messages_total: int = 0
    avg_response_sec: float | None = None
    document_ids: list[UUID] = Field(default_factory=list)

    @property
    def grade_percent(self) -> float | None:
        """Compute grade percentage from raw score and total points."""
        if (
            self.grade_score is not None
            and self.grade_total_points is not None
            and self.grade_total_points > 0
        ):
            return round((self.grade_score / self.grade_total_points) * 100, 2)
        return None

    @property
    def passed(self) -> bool | None:
        """Alias for grade_passed (compat with old *FactsItem types)."""
        return self.grade_passed

    @property
    def persona_id(self) -> UUID | None:
        """Alias for user_persona_id (compat with old *FactsItem types)."""
        return self.user_persona_id

    @property
    def time_taken_seconds(self) -> int | None:
        """Alias for grade_time_taken (compat with old *FactsItem types)."""
        return self.grade_time_taken


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str
    count: int = 0


class GetChatsRequest(BaseModel):
    """Request for getting chats with filters and pagination."""

    # Filters
    profile_id: UUID | None = Field(default=None, description="Filter by profile ID")
    cohort_ids: list[UUID] | None = Field(
        default=None, description="Filter by cohort IDs"
    )
    department_ids: list[UUID] | None = Field(
        default=None, description="Filter by department IDs"
    )
    simulation_ids: list[UUID] | None = Field(
        default=None, description="Filter by simulation IDs"
    )
    scenario_ids: list[UUID] | None = Field(
        default=None, description="Filter by scenario IDs"
    )
    rubric_ids: list[UUID] | None = Field(
        default=None, description="Filter by rubric IDs"
    )
    attempt_id: UUID | None = Field(default=None, description="Filter by attempt ID")
    attempt_type: str | None = Field(
        default=None, description="Filter by attempt type: 'general' | 'practice'"
    )
    is_archived: bool = Field(default=False, description="Include archived attempts")
    date_from: date | None = Field(
        default=None, description="Filter by date range start (inclusive)"
    )
    date_to: date | None = Field(
        default=None, description="Filter by date range end (inclusive)"
    )

    # Sorting
    sort_by: str = Field(
        default="date", description="Sort field: 'date' | 'created_at'"
    )
    sort_order: str = Field(default="desc", description="Sort order: 'asc' | 'desc'")

    # Pagination
    page_limit: int = Field(default=10000, description="Items per page", ge=1, le=50000)
    page_offset: int = Field(default=0, description="Pagination offset", ge=0)


class GetChatsResponse(BaseModel):
    """Response with chat items and pagination info."""

    items: list[ChatItem] = Field(default_factory=list, description="Chat items")
    total_count: int = Field(default=0, description="Total count before pagination")

    # Filter options (for dropdowns)
    simulation_options: list[FilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    cohort_options: list[FilterOption] | None = Field(
        default=None, description="Available cohort filter options"
    )
    department_options: list[FilterOption] | None = Field(
        default=None, description="Available department filter options"
    )
    scenario_options: list[FilterOption] | None = Field(
        default=None, description="Available scenario filter options"
    )
    persona_options: list[FilterOption] | None = Field(
        default=None, description="Available persona filter options"
    )
