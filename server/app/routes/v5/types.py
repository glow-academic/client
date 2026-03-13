"""Shared types for v5 API endpoints.

This module provides reusable type definitions used across multiple artifacts.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.routes.shared_types import (
    QGetAgentsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetSystemsV4Item,
    QGetToolsV4Item,
)


class BaseResourceSection(BaseModel):
    """Common metadata fields for all resource sections.

    Shared across persona, scenario, simulation, cohort, and other artifacts.
    Uses `tool_id` for create tools and `link_tool_id` for link tools.
    """

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ListFilterOption(BaseModel):
    """Standardized option for list endpoint filter sections."""

    id: str | None = None
    name: str | None = None
    count: int | None = None
    hex_code: str | None = None
    value: str | None = None
    type: str | None = None


class ListFilterSection(BaseModel):
    """Filter section with options and echoed request state."""

    options: list[ListFilterOption] | None = None
    selected_ids: list[str] | None = None
    search: str | None = None

    @classmethod
    def from_sql_options(
        cls,
        options: list[Any] | None,
        selected_ids: list[UUID] | None,
        search: str | None,
        id_key: str = "value",
        name_key: str = "label",
        count_key: str = "count",
    ) -> "ListFilterSection":
        """Build from SQL option rows (dict or model). Handles value/label/count
        (scenario/simulation/cohort SQL) and id/name/count (persona hydration)."""

        def _get(o: Any, key: str) -> Any:
            return o.get(key) if isinstance(o, dict) else getattr(o, key, None)

        return cls(
            options=[
                ListFilterOption(
                    id=str(_get(o, id_key)) if _get(o, id_key) else None,
                    name=_get(o, name_key),
                    count=_get(o, count_key),
                )
                for o in (options or [])
            ],
            selected_ids=[str(sid) for sid in (selected_ids or [])]
            if selected_ids
            else None,
            search=search,
        )


class DomainAgent(BaseModel):
    """Maps a domain to its assigned agent and group. Used internally by server."""

    domain_id: UUID
    agent_id: UUID | None = None
    group_id: UUID | None = None  # Per-resource group ID for this domain


class EntryAgent(BaseModel):
    """Maps an entry_type to its assigned agent and per-entry group."""

    entry_type: str  # e.g., "contents", "hints", "grades", "feedbacks"
    agent_id: UUID | None = None
    group_id: UUID | None = None


class DomainData(BaseModel):
    """Rich metadata for a domain, used in generate/regenerate modals."""

    domain_id: UUID
    name: str  # Display name, e.g., "Name", "Description", "Instructions"
    description: str  # Description for tooltips/modals
    resource: str  # Internal resource type (for server use if needed)
    icon: str | None = None  # Optional display icon
    required: bool = False
    show: bool = True


class CandidateAgentRow(BaseModel):
    """SQL row type for candidate agent from composite type."""

    agent_id: UUID
    agent_name: str
    tool_resources: list[str] | None = None
    create_tool_ids: list[UUID | None] | None = None
    link_tool_ids: list[UUID | None] | None = None
    department_ids: list[UUID] | None = None
    updated_at: datetime
    is_mcp: bool = False


@dataclass
class CandidateAgent:
    """Represents a candidate agent with its tool coverage data for scoring."""

    agent_id: UUID
    agent_name: str
    tool_resources: set[str]
    create_tool_ids: dict[str, UUID]  # resource -> create_tool_id
    link_tool_ids: dict[str, UUID]  # resource -> link_tool_id
    department_ids: set[UUID]
    updated_at: datetime
    is_active: bool
    is_mcp: bool = False

    @classmethod
    def from_sql_row(cls, row: dict) -> "CandidateAgent":
        """Create a CandidateAgent from a SQL row dict."""
        # Build tool_id dicts from parallel arrays
        tool_resources = row["tool_resources"] or []
        create_tool_ids_arr = row.get("create_tool_ids") or []
        link_tool_ids_arr = row.get("link_tool_ids") or []

        create_tool_ids: dict[str, UUID] = {}
        link_tool_ids: dict[str, UUID] = {}

        for i, resource in enumerate(tool_resources):
            if i < len(create_tool_ids_arr) and create_tool_ids_arr[i] is not None:
                create_tool_ids[resource] = create_tool_ids_arr[i]
            if i < len(link_tool_ids_arr) and link_tool_ids_arr[i] is not None:
                link_tool_ids[resource] = link_tool_ids_arr[i]

        return cls(
            agent_id=row["agent_id"],
            agent_name=row["agent_name"],
            tool_resources=set(tool_resources),
            create_tool_ids=create_tool_ids,
            link_tool_ids=link_tool_ids,
            department_ids=set(row["department_ids"] or []),
            updated_at=row["updated_at"],
            is_active=True,
            is_mcp=row["is_mcp"] or False,
        )

    @classmethod
    def from_sql_rows(cls, rows: list[dict] | None) -> list["CandidateAgent"]:
        """Create a list of CandidateAgents from SQL rows."""
        if not rows:
            return []
        return [cls.from_sql_row(row) for row in rows]


def build_domain_data(
    domain_ids: dict[str, UUID | None],
    show_flags: dict[str, bool],
    required_flags: dict[str, bool],
    domain_metadata: dict[str, dict[str, str | bool]],
) -> list[DomainData]:
    """Build rich domain metadata for client display.

    Args:
        domain_ids: Mapping of resource type to domain_id
        show_flags: Mapping of resource type to show flag
        required_flags: Mapping of resource type to required flag
        domain_metadata: Mapping of resource type to display metadata (name, description, icon)

    Returns:
        List of DomainData for client consumption
    """
    result: list[DomainData] = []
    for resource, domain_id in domain_ids.items():
        if domain_id is None:
            continue
        meta = domain_metadata.get(resource, {})
        result.append(
            DomainData(
                domain_id=domain_id,
                name=str(meta.get("name", resource.title())),
                description=str(meta.get("description", "")),
                resource=resource,
                icon=str(meta.get("icon")) if meta.get("icon") else None,
                required=required_flags.get(resource, False),
                show=show_flags.get(resource, True),
            )
        )
    return result


class InternalResponseBase(BaseModel):
    """Base for all internal/websocket fetcher responses. Flat config chain."""

    systems: list[QGetSystemsV4Item] | None = None
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None
    args: list[QGetArgsV4Item] | None = None
    args_outputs: list[QGetArgsOutputsV4Item] | None = None
    profile: list[QGetProfilesV4Item] | None = None
    params: BaseModel | None = None
    resource_system_ids: dict[str, UUID | None] | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


class FilterOption(BaseModel):
    """A single filter option for dropdown selectors."""

    value: str
    label: str | None = None
    count: int | None = None


class HistoryItem(BaseModel):
    """Single attempt row in history list."""

    attempt_id: UUID
    date: str | None = None
    profile_id: UUID | None = None
    profile_name: str | None = None
    simulation_id: UUID | None = None
    simulation_name: str | None = None
    num_scenarios: int | None = None
    num_scenarios_completed: int | None = None
    infinite_mode: bool | None = None
    time_limit: int | None = None
    persona_names_junction: list[str] | None = None
    persona_colors_junction: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_titles: list[str] | None = None
    department_ids: list[str] | None = None
    score: int | None = None
    score_status: str | None = None
    pass_pct: int | None = None
    show_view: bool | None = None
    show_continue: bool | None = None
    is_archived: bool | None = None
    practice_simulation: bool | None = None
    practice_scenario_id: UUID | None = None


class HistoryResponse(BaseModel):
    """Paginated attempt history list."""

    data: list[HistoryItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 0
    page_size: int = 20
    total_pages: int = 0
    simulation_options: list[FilterOption] | None = None
    scenario_options: list[FilterOption] | None = None
    profile_options: list[FilterOption] | None = None


class TestHistoryItem(BaseModel):
    """Single test row in history list."""

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


class TestHistoryResponse(BaseModel):
    """Paginated test history list."""

    data: list[TestHistoryItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 0
    page_size: int = 10
    eval_options: list[FilterOption] | None = None


class AnalyticsFilterOptions(BaseModel):
    """Filter options returned by analytics endpoints for populating UI dropdowns."""

    earliest_date: str | None = None
    simulation_options: list[FilterOption] = Field(default_factory=list)
    scenario_options: list[FilterOption] = Field(default_factory=list)
    profile_options: list[FilterOption] = Field(default_factory=list)


class BaseAnalyticsRequest(BaseModel):
    """Common request fields shared across analytics endpoints."""

    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[str] = Field(default_factory=list)
    department_ids: list[str] = Field(default_factory=list)
    simulation_ids: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    simulation_filters: list[str] = Field(default_factory=list)
    actor_profile_id: str | None = None
    target_profile_id: str | None = None
