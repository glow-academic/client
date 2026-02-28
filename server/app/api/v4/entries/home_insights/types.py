"""Canonical home_insights entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class HomeInsightsEntryData(BaseModel):
    """Canonical home_insights entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    group_id: str | None = None
    content: str | None = None


class CreateHomeInsightsEntryRequest(BaseModel):
    run_id: UUID
    group_id: UUID | None = None
    content: str = ""


class CreateHomeInsightsEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateHomeInsightsEntrySqlParams(BaseModel):
    run_id: UUID
    group_id: UUID | None = None
    content: str = ""
    tool_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.group_id, self.content, self.mcp)


class CreateHomeInsightsEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
