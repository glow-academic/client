"""Persona permission helpers.

Extracts business logic from SQL into Python for the two-pass architecture.
These functions compute permissions, UI flags, and access control based on
data fetched from the Pass 1 SQL query.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


def compute_can_edit(
    user_role: str | None,
    persona_department_ids: list[str] | list[UUID] | None,
    active_scenario_count: int,
) -> bool:
    """Unified can_edit logic for both get and list views.

    Constraints:
    1. Not a default persona (unless superadmin)
    2. Not linked to active scenarios
    3. User has admin/instructional/superadmin role
    """
    # Default personas can only be edited by superadmin
    if not persona_department_ids and user_role != "superadmin":
        return False

    # Personas in use by scenarios cannot be edited
    if active_scenario_count > 0:
        return False

    # Role check
    return user_role in ("admin", "instructional", "superadmin")


def compute_disabled_reason(
    user_role: str | None,
    persona_department_ids: list[str] | list[UUID] | None,
    active_scenario_count: int,
) -> str | None:
    """Compute the reason why editing is disabled, if any.

    Returns None if editing is allowed.
    """
    # Default personas can only be edited by superadmin
    if not persona_department_ids and user_role != "superadmin":
        return (
            "This is a default persona that cannot be edited. "
            "You can view the details but cannot make changes."
        )

    # Personas in use by scenarios cannot be edited
    if active_scenario_count > 0:
        return (
            "This persona is currently in use by scenarios and cannot be edited. "
            "You can view the details but cannot make changes."
        )

    # Role check
    if user_role not in ("admin", "instructional", "superadmin"):
        return (
            "This persona cannot be edited. "
            "You can view the details but cannot make changes."
        )

    return None


def get_missing_tools(
    names_has_tools: bool,
    colors_has_tools: bool,
    icons_has_tools: bool,
    instructions_has_tools: bool,
    show_departments: bool,
    departments_has_tools: bool,
    show_fields: bool,
    fields_has_tools: bool,
    show_examples: bool,
    examples_has_tools: bool,
) -> list[str]:
    """Get list of missing required tools."""
    missing = []

    if not names_has_tools:
        missing.append("name")
    if not colors_has_tools:
        missing.append("color")
    if not icons_has_tools:
        missing.append("icon")
    if not instructions_has_tools:
        missing.append("instructions")
    if show_departments and not departments_has_tools:
        missing.append("departments")
    if show_fields and not fields_has_tools:
        missing.append("fields")
    if show_examples and not examples_has_tools:
        missing.append("examples")

    return missing


def has_access(
    user_role: str | None,
    user_department_ids: list[UUID] | None,
    persona_department_ids: list[UUID] | None,
) -> bool:
    """Check if user has access to view the persona.

    Access rules:
    - Superadmin has access to all personas
    - User has access if persona has no departments (default persona)
    - User has access if they share at least one department with the persona
    """
    if user_role == "superadmin":
        return True

    # Default personas (no departments) are accessible to all
    if not persona_department_ids:
        return True

    # Check department overlap
    if not user_department_ids:
        return False

    user_dept_set = set(user_department_ids)
    persona_dept_set = set(persona_department_ids)
    return bool(user_dept_set & persona_dept_set)


def compute_show_name(names_has_tools: bool) -> bool:
    """Determine if name picker should be shown."""
    return names_has_tools


def compute_show_description() -> bool:
    """Determine if description picker should be shown."""
    # Always show description picker
    return True


def compute_show_color(colors_has_tools: bool, colors_count: int) -> bool:
    """Determine if color picker should be shown."""
    return colors_has_tools and colors_count > 0


def compute_show_icon(icons_has_tools: bool, icons_count: int) -> bool:
    """Determine if icon picker should be shown."""
    return icons_has_tools and icons_count > 0


def compute_show_instructions(instructions_has_tools: bool) -> bool:
    """Determine if instructions picker should be shown."""
    return instructions_has_tools


def compute_show_flag() -> bool:
    """Determine if flag toggle should be shown."""
    # Flag is always shown
    return True


def compute_show_departments(departments_count: int) -> bool:
    """Determine if departments picker should be shown."""
    return departments_count > 0


def compute_show_fields(fields_count: int) -> bool:
    """Determine if fields picker should be shown."""
    return fields_count > 0


def compute_show_examples(examples_count: int) -> bool:
    """Determine if examples editor should be shown."""
    # Show examples if there are any existing examples or suggestions
    return examples_count > 0


def compute_show_parameters(parameters_count: int) -> bool:
    """Determine if parameters picker should be shown."""
    return parameters_count > 0


def compute_name_required() -> bool:
    """Determine if name is required."""
    return True


def compute_description_required() -> bool:
    """Determine if description is required."""
    return False


def compute_color_required() -> bool:
    """Determine if color is required."""
    return True


def compute_icon_required() -> bool:
    """Determine if icon is required."""
    return True


def compute_instructions_required() -> bool:
    """Determine if instructions is required."""
    return True


def compute_flag_required() -> bool:
    """Determine if flag is required."""
    return False


def compute_departments_required() -> bool:
    """Determine if departments is required."""
    return False


def compute_fields_required() -> bool:
    """Determine if fields is required."""
    return False


def compute_examples_required() -> bool:
    """Determine if examples is required."""
    return False


def compute_parameters_required() -> bool:
    """Determine if parameters is required."""
    return False


# ========== List Endpoint Permission Functions ==========


def compute_can_delete(
    user_role: str | None,
    persona_department_ids: list[str] | None,
    total_scenario_links: int,
) -> bool:
    """Compute can_delete permission.

    Business logic:
    - Default personas (no departments) cannot be deleted except by superadmin
    - Personas linked to ANY scenario (active or not) cannot be deleted
    - Only admins, instructional, and superadmins can delete
    """
    # Default personas can only be deleted by superadmin
    if not persona_department_ids and user_role != "superadmin":
        return False

    # Personas with any scenario links cannot be deleted
    if total_scenario_links > 0:
        return False

    # Only admins, instructional, and superadmins can delete
    return user_role in ("admin", "instructional", "superadmin")


def compute_can_duplicate(user_role: str | None) -> bool:
    """Compute can_duplicate permission.

    Business logic:
    - Anyone with edit permissions can duplicate
    - Currently always true for admin/instructional/superadmin
    """
    return user_role in ("admin", "instructional", "superadmin")


# ========== Save/Create Endpoint Permission Functions ==========


def compute_can_create(
    user_role: str | None,
    department_ids: list[str] | list[UUID] | None,
) -> bool:
    """Compute permission to create a new persona.

    Business logic (from SQL validate_department_create_permissions):
    - Non-superadmins cannot create general objects (empty department_ids)
    - Only admin/instructional/superadmin can create personas
    """
    # Role check first
    if user_role not in ("admin", "instructional", "superadmin"):
        return False

    # Non-superadmins cannot create general objects (no departments)
    if user_role != "superadmin" and not department_ids:
        return False

    return True


def compute_can_save(
    user_role: str | None,
    user_department_ids: list[str] | list[UUID] | None,
    persona_department_ids: list[str] | list[UUID] | None,
    active_scenario_count: int,
) -> bool:
    """Compute permission to save/update an existing persona.

    Business logic (from SQL validate_department_update_permissions + compute_can_edit):
    - Not a default persona (unless superadmin)
    - Not linked to active scenarios
    - User has admin/instructional/superadmin role
    - Non-superadmins must belong to ALL of the persona's departments
    """
    # Role check first
    if user_role not in ("admin", "instructional", "superadmin"):
        return False

    # Default personas can only be edited by superadmin
    if not persona_department_ids and user_role != "superadmin":
        return False

    # Personas in use by active scenarios cannot be edited
    if active_scenario_count > 0:
        return False

    # Non-superadmins must belong to ALL of the persona's departments
    if user_role != "superadmin" and persona_department_ids:
        if not user_department_ids:
            return False
        # Convert to sets of strings for comparison
        user_dept_set = {str(d) for d in user_department_ids}
        persona_dept_set = {str(d) for d in persona_department_ids}
        # User must have ALL persona departments
        if not persona_dept_set.issubset(user_dept_set):
            return False

    return True


# ========== Draft Endpoint Permission Functions ==========


def compute_can_draft(user_role: str | None) -> bool:
    """Compute permission to create or update a draft.

    Business logic:
    - Only admin/instructional/superadmin can create/edit drafts
    """
    return user_role in ("admin", "instructional", "superadmin")


# ========== Agent Scoring Functions ==========


@dataclass
class CandidateAgent:
    """Represents a candidate agent with its tool coverage data."""

    agent_id: UUID
    agent_name: str
    tool_resources: set[str]  # Resources this agent has tools for
    department_ids: set[UUID]  # Departments this agent belongs to
    updated_at: datetime
    is_active: bool
    is_mcp: bool = False


# Persona-specific resource definitions (hardcoded, rarely changes)
PERSONA_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "colors",
    "icons",
    "instructions",
    "flags",
    "departments",
    "fields",
    "examples",
    "parameters",
}

# Multi-resource agent definitions for persona
PERSONA_BASIC_RESOURCES: set[str] = {"names", "descriptions", "flags", "departments"}
PERSONA_CONTENT_RESOURCES: set[str] = {"instructions", "examples"}
PERSONA_GENERAL_RESOURCES: set[str] = PERSONA_RESOURCES  # All resources


def score_agent_for_artifact(
    agent: CandidateAgent,
    artifact_resources: set[str],
    user_department_ids: set[UUID] | None = None,
) -> tuple[int, int, int, datetime, UUID]:
    """Score an agent for a specific artifact context.

    Returns a tuple for sorting (designed so higher values = better agent):
    - matched_artifact_count: How many artifact resources this agent covers
    - negative extra_outside_count: Fewer non-artifact resources = better
    - negative dept_preference: 0 if matches user department, -1 otherwise
    - updated_at: More recent = better (tiebreaker)
    - agent_id: Final tiebreaker for determinism
    """
    # Count how many artifact resources this agent covers
    matched_artifact_count = len(agent.tool_resources & artifact_resources)

    # Count resources outside the artifact (penalty for being too general)
    extra_outside_count = len(agent.tool_resources - artifact_resources)

    # Department preference (0 = matches or no restriction, -1 = no match)
    dept_preference = 0
    if user_department_ids and agent.department_ids:
        if not (agent.department_ids & user_department_ids):
            dept_preference = -1
    # Agents with no department restrictions get neutral preference (0)

    return (
        matched_artifact_count,  # More coverage = better
        -extra_outside_count,  # Fewer extras = better
        dept_preference,  # Matching dept = better
        agent.updated_at,  # More recent = better
        agent.agent_id,  # Tiebreaker for determinism
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

    Args:
        candidates: List of candidate agents with their tool data
        artifact_resources: Set of resources that belong to this artifact type
        target_resource: The specific resource we need a tool for (e.g., "names")
        user_department_ids: User's department IDs for preference scoring
        require_mcp: If True, only consider MCP-enabled agents

    Returns:
        The best agent's ID, or None if no suitable agent found
    """
    # Filter to active agents that have the target resource
    eligible = [
        agent
        for agent in candidates
        if agent.is_active
        and target_resource in agent.tool_resources
        and (not require_mcp or agent.is_mcp)
    ]

    if not eligible:
        return None

    # Score and sort candidates (higher scores first)
    scored = sorted(
        eligible,
        key=lambda a: score_agent_for_artifact(a, artifact_resources, user_department_ids),
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

    Args:
        candidates: List of candidate agents
        artifact_resources: Set of resources that belong to this artifact type
        resources_needed: List of resources that need agents
        user_department_ids: User's department IDs
        require_mcp: If True, only consider MCP-enabled agents

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
    """Select an agent that has tools for ALL required_resources.

    Scoring:
    1. Must have ALL required_resources
    2. More artifact resources covered = better
    3. Fewer extra resources = better (specialist)
    4. Department preference
    5. Most recent (tiebreaker)

    Args:
        candidates: List of candidate agents
        required_resources: Set of resources the agent MUST have tools for
        artifact_resources: Set of all resources for the artifact type
        user_department_ids: User's department IDs for preference scoring
        require_mcp: If True, only consider MCP-enabled agents

    Returns:
        The best agent's ID, or None if no suitable agent found
    """
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
        key=lambda a: score_agent_for_artifact(a, artifact_resources, user_department_ids),
        reverse=True,
    )

    return scored[0].agent_id if scored else None
