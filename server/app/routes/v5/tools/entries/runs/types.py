"""Runs entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateRunResponse(BaseModel):
    id: UUID
