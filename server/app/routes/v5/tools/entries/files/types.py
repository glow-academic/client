"""Files entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateFileResponse(BaseModel):
    id: UUID


class GetFileResponse(BaseModel):
    id: UUID
    session_id: UUID | None
    active: bool
    mcp: bool
    generated: bool
