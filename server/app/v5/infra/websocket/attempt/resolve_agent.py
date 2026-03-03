"""Agent resolution utility for attempt handlers.

Resolves a single agent ID from a list of agent IDs based on which agent's
tools produce the required entry types. Also provides start-time resolution
of agents per entry type based on profile departments.
"""

from dataclasses import dataclass
from typing import cast
from uuid import UUID

from asyncpg import Connection

from app.v5.sql.types import (
    ResolveAgentByEntryTypesSqlParams,
    ResolveAgentByEntryTypesSqlRow,
    ResolveAttemptEntriesSqlParams,
    ResolveAttemptEntriesSqlRow,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH_RESOLVE = (
    "app/v5/sql/queries/generate/attempt/resolve_agent_by_entry_types_complete.sql"
)
SQL_PATH_RESOLVE_ENTRIES = (
    "app/v5/sql/queries/generate/attempt/resolve_attempt_entries_complete.sql"
)


@dataclass
class AgentResolutionResult:
    """Result of agent resolution."""

    success: bool
    agent_id: UUID | None = None
    error_message: str | None = None


async def resolve_agent_for_entry_types(
    conn: Connection, agent_ids: list[UUID], entry_types: list[str]
) -> AgentResolutionResult:
    """Resolve a single agent ID from list based on entry types.

    Args:
        conn: Database connection
        agent_ids: List of candidate agent IDs
        entry_types: Required entry types (e.g., ['contents', 'hints'] or ['feedbacks'])

    Returns:
        AgentResolutionResult with success=True and agent_id if exactly one agent matches,
        or success=False with error_message if none or multiple match.
    """
    if not agent_ids:
        return AgentResolutionResult(
            success=False,
            error_message="No agent IDs provided",
        )

    params = ResolveAgentByEntryTypesSqlParams(
        p_agent_ids=agent_ids,
        p_entry_types=entry_types,
    )

    row = cast(
        ResolveAgentByEntryTypesSqlRow | None,
        await execute_sql_typed(conn, SQL_PATH_RESOLVE, params=params),
    )

    if not row:
        return AgentResolutionResult(
            success=False,
            error_message="Failed to resolve agent",
        )

    if row.error_code == "none_found":
        entry_types_str = ", ".join(entry_types)
        return AgentResolutionResult(
            success=False,
            error_message=(
                f"None of the provided agents have tools that produce required entries. "
                f"Ensure at least one agent has tools with entries for: {entry_types_str}"
            ),
        )

    if row.error_code == "multiple_found":
        return AgentResolutionResult(
            success=False,
            error_message=(
                "Multiple agents have tools that produce required entries. "
                "Please provide a single specific agent ID."
            ),
        )

    return AgentResolutionResult(
        success=True,
        agent_id=row.resolved_agent_id,
    )


async def resolve_attempt_entries(
    conn: Connection, profile_id: UUID, entry_types: list[str]
) -> dict[str, UUID]:
    """Resolve agent for each attempt entry type based on profile's departments.

    Called at training start time to pre-resolve which agent handles each
    entry type (contents, hints, grades, feedbacks).

    Args:
        conn: Database connection
        profile_id: The profile starting the training
        entry_types: Entry types to resolve (e.g., ['contents', 'hints', 'grades', 'feedbacks'])

    Returns:
        Dict mapping entry_type -> agent_id for each resolved type.
        Entry types with no matching agent are omitted.
    """
    params = ResolveAttemptEntriesSqlParams(
        p_profile_id=profile_id,
        p_entry_types=entry_types,
    )

    rows = cast(
        list[ResolveAttemptEntriesSqlRow],
        await execute_sql_typed(
            conn, SQL_PATH_RESOLVE_ENTRIES, params=params, multi_row=True
        ),
    )

    entries_map: dict[str, UUID] = {}
    for row in rows:
        if row.agent_id:
            entries_map[row.entry_type] = row.agent_id

    return entries_map
