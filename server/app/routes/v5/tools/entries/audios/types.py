"""Audios entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateAudioResponse(BaseModel):
    id: UUID


class GetAudioResponse(BaseModel):
    id: UUID
    session_id: UUID | None
    length_seconds: int
    active: bool
    mcp: bool
    generated: bool
