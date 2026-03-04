"""Images entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateImageResponse(BaseModel):
    id: UUID


class GetImageResponse(BaseModel):
    id: UUID
    session_id: UUID
    active: bool
    mcp: bool
    generated: bool
