"""Metrics entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateMetricsResponse(BaseModel):
    id: UUID


class GetMetricsResponse(BaseModel):
    id: UUID
    ts: datetime
    requests_total: int
    errors_total: int
    avg_latency_ms: float
    cpu_percent: float
    memory_bytes: int
    session_id: UUID | None
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
