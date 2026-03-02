"""Canonical persona entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class PersonaEntryData(BaseModel):
    """Canonical persona entry fields. All optional for streaming support."""

    id: str | None = None
    training_id: str | None = None
    created_at: str | None = None


class CreatePersonaEntryRequest(BaseModel):
    run_id: UUID
    personas_id: UUID | None = None


class CreatePersonaEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreatePersonaEntrySqlParams(BaseModel):
    run_id: UUID
    personas_id: UUID | None = None
    tool_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.personas_id,
            self.tool_id,
            self.mcp,
        )


class CreatePersonaEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
