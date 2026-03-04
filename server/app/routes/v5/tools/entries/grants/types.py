"""Grants canonical types."""

from uuid import UUID

from pydantic import BaseModel


class CreateGrantResponse(BaseModel):
    id: UUID


class GetGrantResponse(BaseModel):
    id: UUID
    session_id: UUID
    expires_at: object
    created_at: object
    active: bool
    mcp: bool
    generated: bool
