"""Types for simulation attempts view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AttemptViewItem(BaseModel):
    """Single attempt from the simulation attempts view."""

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

    # Aggregates (attempt-level only, rubric/scenario/persona data comes from chats)
    total_chats: int = 0
    completed_chats: int = 0
    total_score: float = 0
    all_passed: bool = False
    elapsed_seconds: int = 0


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
