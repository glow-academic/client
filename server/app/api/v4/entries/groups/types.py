"""Canonical groups entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class GroupsEntryData(BaseModel):
    """Canonical groups entry fields. All optional for streaming support."""

    created_at: str | None = None
    id: str | None = None
    trace_id: str | None = None
    session_id: str | None = None
    name: str | None = None
    custom_model: bool | None = None


class CreateGroupsEntrySqlParams(BaseModel):
    session_id: UUID
    name: str | None = None
    custom_model: bool = False
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.name,
            self.custom_model,
            self.mcp,
        )


class CreateGroupsEntrySqlRow(BaseModel):
    id: UUID


class CreateGroupsEntryResponse(BaseModel):
    id: UUID
