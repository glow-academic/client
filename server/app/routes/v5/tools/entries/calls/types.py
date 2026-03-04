"""Calls entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateCallResponse(BaseModel):
    id: UUID


class GetCallResponse(BaseModel):
    id: UUID
    run_id: UUID
    session_id: UUID
    external_call_id: str
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
