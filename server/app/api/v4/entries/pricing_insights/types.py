"""Canonical pricing_insights entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class PricingInsightsEntryData(BaseModel):
    """Canonical pricing_insights entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    group_id: str | None = None
    content: str | None = None


class CreatePricingInsightsEntryRequest(BaseModel):
    run_id: UUID
    group_id: UUID | None = None
    content: str = ""


class CreatePricingInsightsEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreatePricingInsightsEntrySqlParams(BaseModel):
    run_id: UUID
    group_id: UUID | None = None
    content: str = ""
    tool_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.group_id, self.content, self.mcp)


class CreatePricingInsightsEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
