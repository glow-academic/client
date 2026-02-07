"""Types for benchmark tests view (mv_benchmark_tests)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkTestViewItem(BaseModel):
    """Single benchmark test row from mv_benchmark_tests."""

    test_id: UUID
    eval_id: UUID | None = None
    profile_id: UUID | None = None
    department_ids: list[UUID] = Field(default_factory=list)
    infinite_mode: bool = False
    archived: bool = False
    test_created_at: datetime | None = None
    test_updated_at: datetime | None = None
    num_chats: int = 0
    num_chats_completed: int = 0
    num_messages: int = 0

    eval_name_id: UUID | None = None
    eval_description_id: UUID | None = None
    rubric_id: UUID | None = None


class GetBenchmarkTestsRequest(BaseModel):
    """Request for benchmark tests view filtering."""

    test_ids: list[UUID] = Field(default_factory=list)
    eval_id: UUID | None = Field(default=None)
    profile_id: UUID | None = Field(default=None)
    archived: bool | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    sort_by: str = Field(default="date", description="'date' | 'updated'")
    sort_order: str = Field(default="desc")
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class GetBenchmarkTestsResponse(BaseModel):
    """Response for benchmark tests view."""

    items: list[BenchmarkTestViewItem] = Field(default_factory=list)
    total_count: int = 0
