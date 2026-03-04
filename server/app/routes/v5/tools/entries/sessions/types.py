"""Sessions entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateSessionResponse(BaseModel):
    id: UUID


class GetSessionResponse(BaseModel):
    id: UUID
    active: bool
    mcp: bool
    generated: bool
    profiles_id: UUID | None = None
