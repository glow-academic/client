"""Types for benchmark test artifacts endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.benchmark.chats.types import BenchmarkChatViewItem
from app.api.v4.views.benchmark.messages.types import BenchmarkMessageViewItem
from app.api.v4.views.benchmark.tests.types import BenchmarkTestViewItem


class GetTestArtifactRequest(BaseModel):
    """Request for benchmark test artifact detail."""

    test_id: UUID


class GetTestArtifactResponse(BaseModel):
    """Response for benchmark test artifact detail."""

    test: BenchmarkTestViewItem | None = None
    chats: list[BenchmarkChatViewItem] = Field(default_factory=list)
    messages: list[BenchmarkMessageViewItem] = Field(default_factory=list)
    status: str = "pending"


class GetTestListRequest(BaseModel):
    """Request for benchmark test list artifact."""

    eval_ids: list[str] = Field(default_factory=list)
    department_ids: list[str] = Field(default_factory=list)
    page: int = Field(default=0, ge=0)
    page_size: int = Field(default=10, ge=1, le=200)
    search: str | None = Field(default=None)
    status: str | None = Field(default=None)
    archived: bool | None = Field(default=None)
    sort_by: str = Field(default="date")
    sort_order: str = Field(default="desc")


class TestListFilterOption(BaseModel):
    """Filter option row for tests list."""

    value: str
    label: str | None = None
    count: int = 0


class TestListItem(BaseModel):
    """List row for benchmark tests."""

    attempt_id: str
    eval_id: str | None = None
    eval_name: str | None = None
    eval_description: str | None = None
    rubric_id: str | None = None
    rubric_name: str | None = None
    created_at: str | None = None
    archived: bool = False
    status: str = "pending"
    total_runs: int = 0
    completed_runs: int = 0
    pending_runs: int = 0


class GetTestListResponse(BaseModel):
    """Response for benchmark tests list artifact."""

    data: list[TestListItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 0
    page_size: int = 10
    eval_options: list[TestListFilterOption] = Field(default_factory=list)


class ArchiveTestsRequest(BaseModel):
    """Request for archiving/unarchiving benchmark tests."""

    test_ids: list[UUID] = Field(min_length=1)
    archived: bool = True


class ArchiveTestsResponse(BaseModel):
    """Response for archiving/unarchiving benchmark tests."""

    updated_count: int = 0
