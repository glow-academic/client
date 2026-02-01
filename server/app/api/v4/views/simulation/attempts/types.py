"""Types for simulation attempts view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AttemptViewItem(BaseModel):
    """Single attempt from the simulation attempts view."""

    # Primary key
    attempt_id: UUID

    # Resource IDs
    simulation_id: UUID | None = None
    profile_id: UUID | None = None
    cohort_id: UUID | None = None
    department_id: UUID | None = None

    # Resource metadata (JOINed)
    simulation_name: str | None = None
    profile_name: str | None = None
    cohort_name: str | None = None
    department_name: str | None = None

    # Practice flag
    practice: bool = False

    # Timestamps
    attempt_created_at: datetime | None = None

    # Flags
    infinite_mode: bool = False

    # Aggregates
    total_chats: int = 0
    completed_chats: int = 0
    total_score: float = 0
    all_passed: bool = False
    elapsed_seconds: int = 0
    rubric_total_points: int | None = None
    rubric_pass_points: int | None = None

    # Array IDs
    scenario_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None


class GetAttemptsRequest(BaseModel):
    """Request for getting attempt data."""

    attempt_ids: list[UUID] = Field(description="List of attempt IDs to fetch")
    practice: bool | None = Field(
        default=None,
        description="Filter by practice mode. None=all, True=practice, False=home",
    )


class GetAttemptsResponse(BaseModel):
    """Response containing attempt data."""

    items: list[AttemptViewItem] = Field(
        default_factory=list, description="Attempt data items"
    )
