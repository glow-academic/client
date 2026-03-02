"""Canonical runs entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class RunsEntryData(BaseModel):
    """Canonical runs entry fields. All optional for streaming support."""

    created_at: str | None = None
    id: str | None = None
    group_id: str | None = None


class CreateRunsEntrySqlParams(BaseModel):
    session_id: UUID | None = None
    group_id: UUID | None = None
    profiles_id: UUID | None = None
    agent_ids: list[UUID] | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.group_id,
            self.profiles_id,
            self.agent_ids,
            self.mcp,
        )


class CreateRunsEntrySqlRow(BaseModel):
    id: UUID


class CreateRunsEntryResponse(BaseModel):
    id: UUID
