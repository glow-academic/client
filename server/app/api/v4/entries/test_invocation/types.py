"""Canonical test invocation entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TestInvocationEntryData(BaseModel):
    """Canonical test invocation entry fields. All optional for streaming support."""

    id: str | None = None
    test_id: str | None = None
    created_at: str | None = None
    title: str | None = None
    group_id: str | None = None
    suite_department_id: str | None = None


class CreateTestInvocationEntryRequest(BaseModel):
    run_id: UUID
    title: str = ""
    group_id: UUID | None = None
    invocation_id: UUID | None = None
    departments_id: UUID | None = None
    config_signature: str | None = None
    test_id: UUID | None = None


class CreateTestInvocationEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateTestInvocationEntrySqlParams(BaseModel):
    run_id: UUID
    title: str = ""
    group_id: UUID | None = None
    invocation_id: UUID | None = None
    departments_id: UUID | None = None
    config_signature: str | None = None
    test_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.title,
            self.group_id,
            self.invocation_id,
            self.departments_id,
            self.config_signature,
            self.test_id,
            self.mcp,
        )


class CreateTestInvocationEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
