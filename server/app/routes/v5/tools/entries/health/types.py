"""Health entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateHealthResponse(BaseModel):
    id: UUID


class GetHealthResponse(BaseModel):
    id: UUID
    ts: datetime
    service: str
    ok: bool
    latency_ms: float
    error: str
    session_id: UUID | None
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
