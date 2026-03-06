"""Run pricing entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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


class CreateRunPricingResponse(BaseModel):
    id: UUID


class GetRunPricingResponse(BaseModel):
    id: UUID
    pricing_type: str
    count: int
    run_id: UUID
    session_id: UUID | None
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
