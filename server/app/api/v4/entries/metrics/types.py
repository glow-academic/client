"""Canonical metrics entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class MetricsEntryData(BaseModel):
    """Canonical metrics entry fields. All optional for streaming support."""

    ts: str | None = None
    requests_total: int | None = None
    errors_total: int | None = None
    avg_latency_ms: float | None = None
    cpu_percent: float | None = None
    memory_bytes: int | None = None


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
