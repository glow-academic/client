"""Texts entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateTextResponse(BaseModel):
    id: UUID
