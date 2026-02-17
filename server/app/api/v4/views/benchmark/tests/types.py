"""Types for benchmark tests view (test_mv)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkTestViewItem(BaseModel):
    """Single benchmark test row from test_mv."""

    # Primary key
    test_id: UUID

    # Resource IDs (metadata fetched via internal handlers)
    eval_id: UUID | None = None
    profile_id: UUID | None = None
    department_ids: list[UUID] = Field(default_factory=list)

    # Flags
    infinite_mode: bool = False
    archived: bool = False

    # Timestamps
    created_at: datetime | None = None

    # Aggregates derived in service layer from invocations


class GetBenchmarkTestsRequest(BaseModel):
    """Request for benchmark tests view filtering."""

    test_ids: list[UUID] = Field(default_factory=list)
    eval_id: UUID | None = Field(default=None)
    eval_ids: list[UUID] | None = Field(default=None)
    profile_id: UUID | None = Field(default=None)
    archived: bool | None = Field(default=None)
    department_ids: list[UUID] | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    sort_by: str = Field(default="date")
    sort_order: str = Field(default="desc")
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class GetBenchmarkTestsResponse(BaseModel):
    """Response for benchmark tests view."""

    items: list[BenchmarkTestViewItem] = Field(default_factory=list)
    total_count: int = 0
