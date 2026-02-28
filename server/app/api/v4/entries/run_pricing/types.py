"""Canonical run pricing entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class RunPricingEntryData(BaseModel):
    """Canonical run pricing entry fields. All optional for streaming support."""

    pricing_type: str | None = None
    count: int | None = None
    created_at: str | None = None
    run_id: str | None = None
    id: str | None = None


class CreateRunPricingEntrySqlParams(BaseModel):
    session_id: UUID
    pricing_type: str
    run_id: UUID
    count: int = 0
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.pricing_type,
            self.run_id,
            self.count,
            self.mcp,
        )


class CreateRunPricingEntrySqlRow(BaseModel):
    id: UUID


class CreateRunPricingEntryResponse(BaseModel):
    id: UUID
