"""Invocation entry types."""

from uuid import UUID

from pydantic import BaseModel


class CreateInvocationResponse(BaseModel):
    id: UUID
