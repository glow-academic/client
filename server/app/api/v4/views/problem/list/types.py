"""Types for problem list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProblemViewItem(BaseModel):
    """Single problem from the problem list view."""

    problem_id: UUID
    type: str | None = None
    message: str | None = None
    resolved: bool | None = None
    problem_created_at: datetime | None = None
    problem_updated_at: datetime | None = None
    profile_id: UUID | None = None


class GetProblemListViewResponse(BaseModel):
    """Response containing problem list data."""

    items: list[ProblemViewItem] = Field(
        default_factory=list, description="Problem data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
