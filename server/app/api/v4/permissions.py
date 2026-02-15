"""Shared permission utilities for v4 API endpoints.

This module provides reusable agent scoring and selection logic
for artifacts that need Python-based agent selection.
"""

from collections import defaultdict
from datetime import datetime
from uuid import UUID

from app.api.v4.auth.types import SettingsAgentToolEntry
from app.api.v4.types import CandidateAgent


def resolve_agents_for_artifact(
    entries: list[SettingsAgentToolEntry],
    artifact_resources: set[str],
) -> tuple[dict[str, UUID | None], dict[str, UUID | None], dict[str, UUID | None]]:
    """Resolve best agent and tool IDs for each resource using settings entries.

    Groups entries by agent_id to compute coverage (how many artifact resources
    each agent covers). For each resource, picks the agent with highest coverage.

    Returns:
        (agent_ids, create_tool_ids, link_tool_ids) — all resource→UUID|None dicts
    """
    if not entries:
        empty: dict[str, UUID | None] = {r: None for r in artifact_resources}
        return empty, dict(empty), dict(empty)

    # Group entries by agent: agent_id -> list of entries
    agent_entries: dict[UUID, list[SettingsAgentToolEntry]] = defaultdict(list)
    for e in entries:
        agent_entries[e.agent_id].append(e)

    # Compute coverage per agent (how many artifact resources it covers)
    agent_coverage: dict[UUID, int] = {}
    for agent_id, elist in agent_entries.items():
        agent_resources = {e.resource for e in elist}
        agent_coverage[agent_id] = len(agent_resources & artifact_resources)

    agent_ids: dict[str, UUID | None] = {}
    create_tool_ids: dict[str, UUID | None] = {}
    link_tool_ids: dict[str, UUID | None] = {}

    for resource in artifact_resources:
        # Find all entries for this resource
        resource_entries = [e for e in entries if e.resource == resource]
        if not resource_entries:
            agent_ids[resource] = None
            create_tool_ids[resource] = None
            link_tool_ids[resource] = None
            continue

        # Pick agent with highest coverage, then by agent_id for determinism
        best_entry = max(
            resource_entries,
            key=lambda e: (agent_coverage.get(e.agent_id, 0), e.agent_id),
        )
        agent_ids[resource] = best_entry.agent_id

        # Find create/link tool IDs for this agent+resource
        agent_resource_entries = [
            e
            for e in resource_entries
            if e.agent_id == best_entry.agent_id
        ]
        create_tool_ids[resource] = next(
            (e.tool_id for e in agent_resource_entries if e.is_creatable), None
        )
        link_tool_ids[resource] = next(
            (e.tool_id for e in agent_resource_entries if not e.is_creatable), None
        )

    return agent_ids, create_tool_ids, link_tool_ids


def has_tools_for_resource(
    entries: list[SettingsAgentToolEntry], resource: str
) -> bool:
    """Check if any agent has tools for the given resource."""
    return any(e.resource == resource for e in entries)


def score_agent_for_artifact(
    agent: CandidateAgent,
    artifact_resources: set[str],
    user_department_ids: set[UUID] | None = None,
) -> tuple[int, int, int, datetime, UUID]:
    """Score an agent for a specific artifact context.

    Returns a tuple for sorting (designed so higher values = better agent):
    - matched_artifact_count: How many artifact resources this agent covers
    - negative extra_outside_count: Fewer non-artifact resources = better
    - dept_preference: 0 if matches user department, -1 otherwise
    - updated_at: More recent = better (tiebreaker)
    - agent_id: Final tiebreaker for determinism
    """
    matched_artifact_count = len(agent.tool_resources & artifact_resources)
    extra_outside_count = len(agent.tool_resources - artifact_resources)

    dept_preference = 0
    if user_department_ids and agent.department_ids:
        if not (agent.department_ids & user_department_ids):
            dept_preference = -1

    return (
        matched_artifact_count,
        -extra_outside_count,
        dept_preference,
        agent.updated_at,
        agent.agent_id,
    )


def select_best_agent_for_resource(
    candidates: list[CandidateAgent],
    artifact_resources: set[str],
    target_resource: str,
    user_department_ids: set[UUID] | None = None,
    require_mcp: bool = False,
) -> UUID | None:
    """Select the best agent for a specific resource within an artifact context.

    Scoring criteria (in order of priority):
    1. Must have a tool for the target resource
    2. More tools matching artifact resources = better (specialist)
    3. Fewer tools outside artifact resources = better (not too general)
    4. Matching user department = better
    5. More recently updated = better (tiebreaker)
    """
    eligible = [
        agent
        for agent in candidates
        if agent.is_active
        and target_resource in agent.tool_resources
        and (not require_mcp or agent.is_mcp)
    ]

    if not eligible:
        return None

    scored = sorted(
        eligible,
        key=lambda a: score_agent_for_artifact(
            a, artifact_resources, user_department_ids
        ),
        reverse=True,
    )

    return scored[0].agent_id if scored else None


def select_agents_for_artifact(
    candidates: list[CandidateAgent],
    artifact_resources: set[str],
    resources_needed: list[str],
    user_department_ids: set[UUID] | None = None,
    require_mcp: bool = False,
) -> dict[str, UUID | None]:
    """Select the best agent for each resource in an artifact.

    Returns:
        Dict mapping resource name to best agent ID (or None)
    """
    return {
        resource: select_best_agent_for_resource(
            candidates, artifact_resources, resource, user_department_ids, require_mcp
        )
        for resource in resources_needed
    }


def select_multi_resource_agent(
    candidates: list[CandidateAgent],
    required_resources: set[str],
    artifact_resources: set[str],
    user_department_ids: set[UUID] | None = None,
    require_mcp: bool = False,
) -> UUID | None:
    """Select an agent that has tools for ALL required_resources."""
    eligible = [
        agent
        for agent in candidates
        if agent.is_active
        and required_resources.issubset(agent.tool_resources)
        and (not require_mcp or agent.is_mcp)
    ]

    if not eligible:
        return None

    scored = sorted(
        eligible,
        key=lambda a: score_agent_for_artifact(
            a, artifact_resources, user_department_ids
        ),
        reverse=True,
    )

    return scored[0].agent_id if scored else None
