"""Shared permission utilities for v4 API endpoints.

This module provides reusable agent scoring and selection logic
for artifacts that need Python-based agent selection.
"""

from datetime import datetime
from uuid import UUID

from app.api.v4.types import CandidateAgent


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
