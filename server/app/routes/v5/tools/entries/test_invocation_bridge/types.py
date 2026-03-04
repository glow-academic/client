"""Test invocation bridge entry types."""

from uuid import UUID

from pydantic import BaseModel


class CreateTestInvocationBridgeResponse(BaseModel):
    test_invocation_id: UUID
    invocation_id: UUID
