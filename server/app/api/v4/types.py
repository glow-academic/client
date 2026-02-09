"""Shared types for v4 API endpoints.

This module provides reusable type definitions used across multiple artifacts.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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
