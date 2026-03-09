"""Types for benchmark test artifacts endpoints.

Three-layer BFF pattern types:
- GetTestArtifactResponse: HTTP client response
- TestInternalData: Core data container (internal layer)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from pydantic import BaseModel, Field

from app.routes.v5.tools.entries.messages.types import SearchMessageResponse
from app.routes.v5.tools.entries.test.types import GetTestResponse
from app.routes.v5.tools.entries.test_feedback.types import GetTestFeedbackResponse
from app.routes.v5.tools.entries.test_grade.types import GetTestGradeResponse
from app.routes.v5.tools.entries.test_invocation.types import GetTestInvocationResponse
from app.routes.v5.tools.entries.test_invocation_groups.types import (
    GetTestInvocationGroupsResponse,
)
from app.routes.v5.tools.entries.test_invocation_runs.types import (
    GetTestInvocationRunsResponse,
)

# =============================================================================
# Client-facing types
# =============================================================================


class GetTestArtifactRequest(BaseModel):
    """Request for benchmark test artifact detail."""

    test_id: UUID


class TestRunItem(BaseModel):
    """A single run row for the UI table, derived from a benchmark invocation."""

    chat_id: str
    invocation_id: str
    run_id: str | None = None
    group_id: str | None = None
    suite_entry_id: str | None = None
    model_name: str | None = None
    agent_name: str | None = None
    status: str = "not_started"
    grade_score: float | None = None
    grade_passed: bool | None = None


class TestStatusSummary(BaseModel):
    total: int = 0
    completed: int = 0
    in_progress: int = 0
    not_started: int = 0


class TestEntries(BaseModel):
    """Entry payloads grouped by type."""

    tests: list[GetTestResponse] | None = None
    invocations: list[GetTestInvocationResponse] | None = None
    runs: list[GetTestInvocationRunsResponse] | None = None
    groups: list[GetTestInvocationGroupsResponse] | None = None
    grades: list[GetTestGradeResponse] | None = None
    feedback: list[GetTestFeedbackResponse] | None = None
    messages: list[SearchMessageResponse] | None = None


class TestResources(BaseModel):
    """Resource maps keyed by ID string."""

    evals: dict[str, dict] | None = None
    rubrics: dict[str, dict] | None = None
    agents: dict[str, dict] | None = None
    models: dict[str, dict] | None = None
    voices: dict[str, dict] | None = None
    temperature_levels: dict[str, dict] | None = None
    reasoning_levels: dict[str, dict] | None = None
    modalities: dict[str, dict] | None = None
    prompts: dict[str, dict] | None = None
    instructions: dict[str, dict] | None = None
    tools: dict[str, dict] | None = None
    qualities: dict[str, dict] | None = None


class GetTestArtifactResponse(BaseModel):
    """Response for benchmark test artifact detail."""

    test: GetTestResponse | None = None
    invocations: list[GetTestInvocationResponse] = Field(default_factory=list)
    status: str = "pending"

    # Hydrated eval info
    eval_name: str | None = None
    eval_description: str | None = None
    rubric_name: str | None = None
    infinite_mode: bool = False

    # Runs derived from invocations
    runs: list[TestRunItem] = Field(default_factory=list)

    # Status summary
    status_summary: TestStatusSummary | None = None

    # Inline controls data (replaces auth/group resolution for toolbar)
    show_controls: bool = False
    current_invocation_id: str | None = None
    has_runs_or_groups: bool = False

    # Normalized entries and resources
    entries: TestEntries | None = None
    resources: TestResources | None = None


# =============================================================================
# Internal data (three-layer BFF pattern)
# =============================================================================


@dataclass
class TestInternalData:
    """Core data container returned by get_test_internal().

    Contains all fetched and computed values. Consumer layers
    (get_test_client, get_test_websocket) reshape this
    into their specific response types.
    """

    # Raw entry results
    test: GetTestResponse | None = None
    invocations: list[GetTestInvocationResponse] = field(default_factory=list)

    # Hydrated eval info
    eval_name: str | None = None
    eval_description: str | None = None

    # Rubric info
    rubric_name_map: dict[UUID, str] = field(default_factory=dict)

    # Computed
    runs: list[TestRunItem] = field(default_factory=list)
    status: str = "pending"
    status_summary: TestStatusSummary = field(default_factory=TestStatusSummary)

    # Inline controls data (replaces auth/group resolution)
    show_controls: bool = False
    current_invocation_id: str | None = None
    has_runs_or_groups: bool = False

    # Full entries + resources
    entries_payload: TestEntries = field(default_factory=TestEntries)
    resources_payload: TestResources = field(default_factory=TestResources)


# =============================================================================
# List types (used by other endpoints)
# =============================================================================


class GetTestListRequest(BaseModel):
    """Request for benchmark test list artifact."""

    start_date: str | None = Field(default=None)
    end_date: str | None = Field(default=None)
    eval_ids: list[str] = Field(default_factory=list)
    department_ids: list[str] = Field(default_factory=list)
    page: int = Field(default=0, ge=0)
    page_size: int = Field(default=10, ge=1, le=200)
    search: str | None = Field(default=None)
    status: str | None = Field(default=None)
    archived: bool | None = Field(default=None)
    sort_by: str = Field(default="date")
    sort_order: str = Field(default="desc")


class TestListFilterOption(BaseModel):
    """Filter option row for tests list."""

    value: str
    label: str | None = None
    count: int = 0


class TestListItem(BaseModel):
    """List row for benchmark tests."""

    attempt_id: str
    eval_id: str | None = None
    eval_name: str | None = None
    eval_description: str | None = None
    rubric_id: str | None = None
    rubric_name: str | None = None
    created_at: str | None = None
    archived: bool = False
    status: str = "pending"
    total_runs: int = 0
    completed_runs: int = 0
    pending_runs: int = 0


class GetTestListResponse(BaseModel):
    """Response for benchmark tests list artifact."""

    data: list[TestListItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 0
    page_size: int = 10
    eval_options: list[TestListFilterOption] = Field(default_factory=list)


class ArchiveTestsRequest(BaseModel):
    """Request for archiving/unarchiving benchmark tests."""

    test_ids: list[UUID] = Field(min_length=1)
    archived: bool = True


class ArchiveTestsResponse(BaseModel):
    """Response for archiving/unarchiving benchmark tests."""

    updated_count: int = 0


# =============================================================================
# Export Types
# =============================================================================


class ExportTestApiResponse(BaseModel):
    """Response model for test export."""

    upload_id: UUID
    file_name: str
    row_count: int
