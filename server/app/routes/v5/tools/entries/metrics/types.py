"""Metrics entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateMetricsEntrySqlParams(BaseModel):
    session_id: UUID
    ts: str
    requests_total: int
    errors_total: int
    avg_latency_ms: float
    cpu_percent: float
    memory_bytes: int
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.ts,
            self.requests_total,
            self.errors_total,
            self.avg_latency_ms,
            self.cpu_percent,
            self.memory_bytes,
            self.mcp,
        )


class CreateMetricsEntrySqlRow(BaseModel):
    out_ts: str


class CreateMetricsEntryResponse(BaseModel):
    ts: str


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
