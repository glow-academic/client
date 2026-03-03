"""Groups entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateGroupResponse(BaseModel):
    id: UUID


class GetGroupResponse(BaseModel):
    id: UUID
    session_id: UUID | None
    name: str | None
    active: bool
    mcp: bool
    generated: bool
