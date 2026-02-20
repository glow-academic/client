"""Canonical test invocation entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TestInvocationEntryData(BaseModel):
    """Canonical test invocation entry fields. All optional for streaming support."""

    id: str | None = None
    test_id: str | None = None
    created_at: str | None = None
    title: str | None = None
    group_id: str | None = None
    suite_department_id: str | None = None
