"""Entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateTestInvocationRunsResponse(BaseModel):
    id: UUID


class GetTestInvocationRunsResponse(BaseModel):
    id: UUID
    test_invocation_id: UUID
    created_at: datetime
    updated_at: datetime
    generated: bool
    mcp: bool
    active: bool
