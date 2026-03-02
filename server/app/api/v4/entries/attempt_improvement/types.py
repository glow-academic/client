"""Canonical improvements entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ImprovementsEntryData(BaseModel):
    """Canonical improvements entry fields. All optional for streaming support."""

    improvement_id: str | None = None
    message_id: str | None = None
    name: str | None = None
    description: str | None = None
    created_at: str | None = None


class CreateAttemptImprovementEntryRequest(BaseModel):
    run_id: UUID
    grade_id: UUID
    message_id: UUID
    name: str = ""
    description: str = ""


class CreateAttemptImprovementEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptImprovementEntrySqlParams(BaseModel):
    run_id: UUID
    grade_id: UUID
    message_id: UUID
    name: str = ""
    description: str = ""
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.grade_id,
            self.message_id,
            self.name,
            self.description,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateAttemptImprovementEntrySqlRow(BaseModel):
    entry_id: UUID
    entry_call_id: UUID
    entry_message_id: UUID
