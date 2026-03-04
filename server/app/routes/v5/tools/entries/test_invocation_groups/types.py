"""Entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateTestInvocationGroupsResponse(BaseModel):
    id: UUID


class GetTestInvocationGroupsResponse(BaseModel):
    id: UUID
    test_invocation_id: UUID
    created_at: datetime
    updated_at: datetime
    generated: bool
    mcp: bool
    active: bool
