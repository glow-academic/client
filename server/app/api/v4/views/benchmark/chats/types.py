"""Types for benchmark chats view (mv_benchmark_chats)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkChatViewItem(BaseModel):
    """Single benchmark chat row from mv_benchmark_chats."""

    chat_id: UUID
    test_id: UUID
    eval_id: UUID | None = None
    run_ids: list[UUID] = Field(default_factory=list)
    group_id: UUID | None = None
    chat_created_at: datetime | None = None
    chat_updated_at: datetime | None = None
    chat_title: str | None = None
    chat_completed: bool = False
    grade_score: int | None = None
    grade_passed: bool | None = None
    grade_time_taken: int | None = None
    num_messages: int = 0


class GetBenchmarkChatsRequest(BaseModel):
    """Request for benchmark chats view filtering."""

    test_id: UUID | None = Field(default=None)
    chat_ids: list[UUID] = Field(default_factory=list)


class GetBenchmarkChatsResponse(BaseModel):
    """Response for benchmark chats view."""

    items: list[BenchmarkChatViewItem] = Field(default_factory=list)
