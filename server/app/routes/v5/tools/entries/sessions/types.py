"""Sessions entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateSessionResponse(BaseModel):
    id: UUID


class GetSessionResponse(BaseModel):
    id: UUID
    session_id: UUID | None
    active: bool
    mcp: bool
    generated: bool
    profiles_id: UUID | None = None
