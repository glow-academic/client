"""Types for benchmark messages view (mv_benchmark_messages)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BenchmarkMessageViewItem(BaseModel):
    """Single benchmark message row from mv_benchmark_messages."""

    message_id: UUID
    chat_id: UUID
    test_id: UUID
    eval_id: UUID | None = None
    run_id: UUID | None = None
    type: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    completed: bool = False


class GetBenchmarkMessagesRequest(BaseModel):
    """Request for benchmark messages view filtering."""

    test_id: UUID | None = Field(default=None)
    chat_id: UUID | None = Field(default=None)


class GetBenchmarkMessagesResponse(BaseModel):
    """Response for benchmark messages view."""

    items: list[BenchmarkMessageViewItem] = Field(default_factory=list)
