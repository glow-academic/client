"""Shared types for v4 API endpoints.

This module provides reusable type definitions used across multiple artifacts.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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
