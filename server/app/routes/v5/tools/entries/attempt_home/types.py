"""Attempt home entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateAttemptHomeResponse(BaseModel):
    attempt_id: UUID
    home_id: UUID
