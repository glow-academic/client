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

    eval_id: UUID | None = Field(default=None)
    archived: bool | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    sort_by: str = Field(default="date")
    sort_order: str = Field(default="desc")
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class TestListFilterOption(BaseModel):
    """Filter option row for tests list."""

    value: str
    label: str | None = None
    count: int = 0


class TestListItem(BaseModel):
    """List row for benchmark tests."""

    test_id: UUID
    eval_id: UUID | None = None
    profile_id: UUID | None = None
    archived: bool = False
    created_at: datetime | None = None
    num_chats: int = 0
    num_chats_completed: int = 0
    num_messages: int = 0
    status: str = "pending"


class GetTestListResponse(BaseModel):
    """Response for benchmark tests list artifact."""

    data: list[TestListItem] = Field(default_factory=list)
    total_count: int = 0
    page_limit: int = 50
    page_offset: int = 0
    eval_options: list[TestListFilterOption] = Field(default_factory=list)


class ArchiveTestsRequest(BaseModel):
    """Request for archiving/unarchiving benchmark tests."""

    test_ids: list[UUID] = Field(min_length=1)
    archived: bool = True


class ArchiveTestsResponse(BaseModel):
    """Response for archiving/unarchiving benchmark tests."""

    updated_count: int = 0
