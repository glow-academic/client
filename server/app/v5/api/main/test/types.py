"""Types for benchmark test artifacts endpoints.

Three-layer BFF pattern types:
- GetTestArtifactResponse: HTTP client response
- TestInternalData: Core data container (internal layer)
- GetTestWebsocketResponse: WebSocket response with config resources
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from pydantic import BaseModel, Field

from app.v5.api.main.types import InternalResponseBase
from app.v5.api.entries.runs.search import GetRunListViewResponse
from app.v5.sql.types import (
    QGetAgentsV4Item,
    QGetModelsV4Item,
    QGetProvidersV4Item,
    QGetTestInvocationViewV4Item,
    QGetTestListViewV4Item,
)

# =============================================================================
# Client-facing types
# =============================================================================


class GetTestArtifactRequest(BaseModel):
    """Request for benchmark test artifact detail."""

    test_id: UUID


class TestRunItem(BaseModel):
    """A single run row for the UI table, derived from a benchmark invocation."""

    # Backward-compatible alias (same value as invocation_id)
    chat_id: str
    invocation_id: str
    run_id: str | None = None
    group_id: str | None = None
    suite_entry_id: str | None = None
    model_name: str | None = None
    agent_name: str | None = None
    status: str = "not_started"
    grade_score: int | None = None
    grade_passed: bool | None = None


class TestStatusSummary(BaseModel):
    total: int = 0
    completed: int = 0
    in_progress: int = 0
    not_started: int = 0


class TestEntries(BaseModel):
    """View payloads grouped by view type."""

    test: list[QGetTestListViewV4Item] | None = None
    test_invocation: list[QGetTestInvocationViewV4Item] | None = None
    runs: GetRunListViewResponse | None = None


class TestResources(BaseModel):
    """Content resource maps keyed by ID string."""

    evals: dict[str, dict] | None = None
    rubrics: dict[str, dict] | None = None
    names: dict[str, str] | None = None


class GetTestArtifactResponse(BaseModel):
    """Response for benchmark test artifact detail."""

    test: QGetTestListViewV4Item | None = None
    invocations: list[QGetTestInvocationViewV4Item] = Field(default_factory=list)
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

    # Normalized views and resources
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

    # Raw MV results
    test: QGetTestListViewV4Item | None = None
    invocations: list[QGetTestInvocationViewV4Item] = field(default_factory=list)

    # Config chain
    group_id: UUID | None = None
    agent_ids: dict[str, UUID | None] = field(default_factory=dict)

    # Hydrated eval info
    eval_name: str | None = None
    eval_description: str | None = None

    # Rubric info (collected from invocations)
    rubric_name_map: dict[UUID, str] = field(default_factory=dict)

    # Run-level hydration
    run_name_map: dict[UUID, tuple[UUID | None, UUID | None]] = field(
        default_factory=dict
    )
    run_bundle_map: dict[UUID, UUID] = field(default_factory=dict)
    name_map: dict[UUID, str] = field(default_factory=dict)

    # Computed
    runs: list[TestRunItem] = field(default_factory=list)
    status: str = "pending"
    status_summary: TestStatusSummary = field(default_factory=TestStatusSummary)

    # Resources payload
    resources_payload: TestResources = field(default_factory=TestResources)

    # Config resources (from group -> config chain)
    config_agent_resources: list[QGetAgentsV4Item] | None = None
    config_model_resources: list[QGetModelsV4Item] | None = None
    config_provider_resources: list[QGetProvidersV4Item] | None = None


# =============================================================================
# WebSocket response types (three-layer BFF pattern)
# =============================================================================


class TestWebsocketResources(BaseModel):
    """Content resources for websocket."""

    # Content resources
    evals: dict[str, dict] | None = None
    rubrics: dict[str, dict] | None = None
    names: dict[str, str] | None = None


class GetTestWebsocketResponse(InternalResponseBase):
    """Minimal response for WebSocket handlers."""

    entries: TestEntries | None = None
    resources: TestWebsocketResources | None = None


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
