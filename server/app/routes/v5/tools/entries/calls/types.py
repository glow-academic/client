"""Calls entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateCallResponse(BaseModel):
    id: UUID


class GetCallResponse(BaseModel):
    id: UUID
    run_id: UUID | None
    session_id: UUID | None
    external_call_id: str | None
    created_at: datetime
    completed_at: datetime | None
    active: bool
    mcp: bool
    generated: bool
