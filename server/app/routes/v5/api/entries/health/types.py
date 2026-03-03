"""Canonical health entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class HealthEntryData(BaseModel):
    """Canonical health entry fields. All optional for streaming support."""

    ts: str | None = None
    service: str | None = None
    ok: bool | None = None
    latency_ms: float | None = None
    error: str | None = None
