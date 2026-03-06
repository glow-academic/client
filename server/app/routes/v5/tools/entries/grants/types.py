"""Grants canonical types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateGrantResponse(BaseModel):
    id: UUID


class GetGrantResponse(BaseModel):
    grant_id: UUID
    grantor_id: UUID | None
    emulation_id: UUID | None
    emulated_id: UUID | None
    grant_session_id: UUID
    emulation_session_id: UUID | None
    expires_at: datetime | None
    used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
