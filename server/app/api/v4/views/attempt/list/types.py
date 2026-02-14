"""Types for attempt list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str
    count: int = 0


class AttemptViewItem(BaseModel):
    """Single attempt from the attempt list view."""

    # Primary key
    attempt_id: UUID

    # Resource IDs (metadata fetched via internal handlers)
    simulation_id: UUID | None = None
    profile_id: UUID | None = None
    cohort_id: UUID | None = None
    department_id: UUID | None = None

    # Flags
    practice: bool = False
    infinite_mode: bool = False

    # Timestamps
    created_at: datetime | None = None

    # Archived flag
    is_archived: bool = False

    # Scenario IDs (for filtering and display)
    scenario_ids: list[UUID] | None = None

    # Aggregates derived in service layer from chats


class GetAttemptsRequest(BaseModel):
    """Request for getting attempt data."""

    attempt_ids: list[UUID] = Field(description="List of attempt IDs to fetch")


class GetAttemptsResponse(BaseModel):
    """Response containing attempt data."""

    items: list[AttemptViewItem] = Field(
        default_factory=list, description="Attempt data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")

    # Filter options (for dropdowns)
    simulation_options: list[FilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    scenario_options: list[FilterOption] | None = Field(
        default=None, description="Available scenario filter options"
    )
    profile_options: list[FilterOption] | None = Field(
        default=None, description="Available profile filter options"
    )
