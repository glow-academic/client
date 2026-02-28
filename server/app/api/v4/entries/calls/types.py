"""Canonical calls entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class CallsEntryData(BaseModel):
    """Canonical calls entry fields. All optional for streaming support."""

    created_at: str | None = None
    external_call_id: str | None = None
    id: str | None = None
    arguments_raw: str | None = None
    run_id: str | None = None


class CreateCallsEntrySqlParams(BaseModel):
    session_id: UUID
    external_call_id: str
    run_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.external_call_id,
            self.run_id,
            self.mcp,
        )


class CreateCallsEntrySqlRow(BaseModel):
    id: UUID


class CreateCallsEntryResponse(BaseModel):
    id: UUID
