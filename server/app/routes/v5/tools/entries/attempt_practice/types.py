"""Attempt practice entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateAttemptPracticeResponse(BaseModel):
    attempt_id: UUID
    practice_id: UUID
