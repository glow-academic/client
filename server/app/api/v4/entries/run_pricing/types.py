"""Canonical run pricing entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class RunPricingEntryData(BaseModel):
    """Canonical run pricing entry fields. All optional for streaming support."""

    pricing_type: str | None = None
    count: int | None = None
    created_at: str | None = None
    run_id: str | None = None
    unit_id: str | None = None
    id: str | None = None
