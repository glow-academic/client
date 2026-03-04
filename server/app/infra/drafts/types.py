"""Shared types for all drafts entries."""

from uuid import UUID

from pydantic import BaseModel


class CreateDraftResponse(BaseModel):
    id: UUID


class GetDraftResponse(BaseModel):
    id: UUID
    version: int
    group_id: UUID
    session_id: UUID
    created_at: object
    active: bool
    mcp: bool
    generated: bool
