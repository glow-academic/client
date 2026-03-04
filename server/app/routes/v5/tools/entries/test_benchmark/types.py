"""Test benchmark bridge entry types."""

from uuid import UUID

from pydantic import BaseModel


class CreateTestBenchmarkResponse(BaseModel):
    test_id: UUID
    benchmark_id: UUID
