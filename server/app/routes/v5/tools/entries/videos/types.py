"""Videos entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateVideoResponse(BaseModel):
    id: UUID


class GetVideoResponse(BaseModel):
    id: UUID
    session_id: UUID
    length_seconds: int
    active: bool
    mcp: bool
    generated: bool
