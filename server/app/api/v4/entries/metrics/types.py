"""Canonical metrics entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class MetricsEntryData(BaseModel):
    """Canonical metrics entry fields. All optional for streaming support."""

    ts: str | None = None
    requests_total: int | None = None
    errors_total: int | None = None
    avg_latency_ms: float | None = None
    cpu_percent: float | None = None
    memory_bytes: int | None = None
