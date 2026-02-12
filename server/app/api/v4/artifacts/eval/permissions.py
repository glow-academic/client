"""Eval permission helpers.

Extracts business logic from SQL into Python for the two-pass architecture.
These functions compute permissions, UI flags, and access control based on
data fetched from the Pass 1 SQL query.
"""

from uuid import UUID

from app.api.v4.permissions import (
    select_agents_for_artifact,
    select_multi_resource_agent,
)
from app.api.v4.types import CandidateAgent

# Re-export for backwards compatibility
__all__ = [
    "CandidateAgent",
    "select_agents_for_artifact",
    "select_multi_resource_agent",
    "EVAL_RESOURCES",
    "EVAL_BASIC_RESOURCES",
]


def compute_can_edit(
    user_role: str | None,
    eval_department_ids: list[str] | list[UUID] | None,
    active_usage_count: int,
) -> bool:
    """Unified can_edit logic for both get and list views.

    Constraints:
    1. User has admin/instructional/superadmin role
    2. Eval not in active use (benchmarks running)
    """
    # Role check
    if user_role not in ("admin", "instructional", "superadmin"):
        return False

    return True


def compute_disabled_reason(
    user_role: str | None,
    eval_department_ids: list[str] | list[UUID] | None,
    active_usage_count: int,
) -> str | None:
    """Compute the reason why editing is disabled, if any."""
    if user_role not in ("admin", "instructional", "superadmin"):
        return (
            "This eval cannot be edited. "
            "You can view the details but cannot make changes."
        )

    return None


def get_missing_tools(
    names_has_tools: bool,
    descriptions_has_tools: bool,
    flags_has_tools: bool,
    show_departments: bool,
    departments_has_tools: bool,
    show_agents: bool,
    agents_has_tools: bool,
    show_rubrics: bool,
    rubrics_has_tools: bool,
) -> list[str]:
    """Get list of missing required tools."""
    missing = []

    if not names_has_tools:
        missing.append("name")
    if not descriptions_has_tools:
        missing.append("description")
    if not flags_has_tools:
        missing.append("flags")
    if show_departments and not departments_has_tools:
        missing.append("departments")
    if show_agents and not agents_has_tools:
        missing.append("agents")
    if show_rubrics and not rubrics_has_tools:
        missing.append("rubrics")

    return missing


def has_access(
    user_role: str | None,
    user_department_ids: list[UUID] | None,
    eval_department_ids: list[UUID] | None,
) -> bool:
    """Check if user has access to view the eval.

    Access rules:
    - Superadmin has access to all evals
    - User has access if eval has no departments (general eval)
    - User has access if they share at least one department with the eval
    """
    if user_role == "superadmin":
        return True

    # General evals (no departments) are accessible to all
    if not eval_department_ids:
        return True

    # Check department overlap
    if not user_department_ids:
        return False

    user_dept_set = set(user_department_ids)
    eval_dept_set = set(eval_department_ids)
    return bool(user_dept_set & eval_dept_set)


def compute_show_name(names_has_tools: bool) -> bool:
    """Determine if name picker should be shown."""
    return names_has_tools


def compute_show_description() -> bool:
    """Determine if description picker should be shown."""
    return True


def compute_show_active_flag() -> bool:
    """Determine if active flag toggle should be shown."""
    return True


def compute_show_dynamic_flag() -> bool:
    """Determine if dynamic flag toggle should be shown."""
    return True


def compute_show_groups_flag() -> bool:
    """Determine if groups flag toggle should be shown."""
    return True


def compute_show_departments(departments_count: int) -> bool:
    """Determine if departments picker should be shown."""
    return departments_count > 0


def compute_show_agents(agents_count: int) -> bool:
    """Determine if agents picker should be shown."""
    return agents_count > 0


def compute_show_rubrics(rubrics_count: int) -> bool:
    """Determine if rubrics picker should be shown."""
    return rubrics_count > 0


def compute_name_required() -> bool:
    """Determine if name is required."""
    return True


def compute_description_required() -> bool:
    """Determine if description is required."""
    return False


def compute_active_flag_required() -> bool:
    """Determine if active flag is required."""
    return False


def compute_dynamic_flag_required() -> bool:
    """Determine if dynamic flag is required."""
    return False


def compute_groups_flag_required() -> bool:
    """Determine if groups flag is required."""
    return False


def compute_departments_required(show_departments: bool) -> bool:
    """Determine if departments is required."""
    return show_departments


def compute_agents_required(show_agents: bool) -> bool:
    """Determine if agents is required."""
    return show_agents


def compute_rubrics_required(show_rubrics: bool) -> bool:
    """Determine if rubrics is required."""
    return show_rubrics


# ========== List Endpoint Permission Functions ==========


def compute_can_delete(
    user_role: str | None,
    eval_department_ids: list[str] | None,
    total_usage_links: int,
) -> bool:
    """Compute can_delete permission.

    Business logic:
    - Evals with active usage links cannot be deleted
    - Only admins, instructional, and superadmins can delete
    """
    if total_usage_links > 0:
        return False

    return user_role in ("admin", "instructional", "superadmin")


def compute_can_duplicate(user_role: str | None) -> bool:
    """Compute can_duplicate permission."""
    return user_role in ("admin", "instructional", "superadmin")


# ========== Save/Create Endpoint Permission Functions ==========


def compute_can_create(
    user_role: str | None,
    department_ids: list[str] | list[UUID] | None,
) -> bool:
    """Compute permission to create a new eval."""
    if user_role not in ("admin", "instructional", "superadmin"):
        return False

    # Non-superadmins cannot create general objects (no departments)
    if user_role != "superadmin" and not department_ids:
        return False

    return True


def compute_can_save(
    user_role: str | None,
    user_department_ids: list[str] | list[UUID] | None,
    eval_department_ids: list[str] | list[UUID] | None,
    active_usage_count: int,
) -> bool:
    """Compute permission to save/update an existing eval."""
    if user_role not in ("admin", "instructional", "superadmin"):
        return False

    return True


# ========== Draft Endpoint Permission Functions ==========


def compute_can_draft(user_role: str | None) -> bool:
    """Compute permission to create or update a draft."""
    return user_role in ("admin", "instructional", "superadmin")


# ========== Agent Scoring - Eval-specific Constants ==========

EVAL_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "flags",
    "departments",
    "rubrics",
}

EVAL_BASIC_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "flags",
    "departments",
}


# ========== Domain Metadata - for client-side display in modals ==========

EVAL_DOMAIN_METADATA: dict[str, dict[str, str | bool]] = {
    "names": {
        "name": "Name",
        "description": "The display name for this eval",
        "icon": "clipboard-check",
    },
    "descriptions": {
        "name": "Description",
        "description": "A brief description of this eval's purpose",
        "icon": "file-text",
    },
    "flags": {
        "name": "Status",
        "description": "Active/inactive and configuration flags",
        "icon": "flag",
    },
    "departments": {
        "name": "Departments",
        "description": "Which departments can access this eval",
        "icon": "building",
    },
    "rubrics": {
        "name": "Rubrics",
        "description": "Rubrics for scoring evaluations",
        "icon": "list-checks",
    },
}


def build_domain_data(
    domain_ids: dict[str, UUID | None],
    show_flags: dict[str, bool],
    required_flags: dict[str, bool],
) -> list:
    """Build rich domain metadata for client display.

    Delegates to shared build_domain_data with eval-specific metadata.
    """
    from app.api.v4.types import build_domain_data as _build_domain_data

    return _build_domain_data(
        domain_ids, show_flags, required_flags, EVAL_DOMAIN_METADATA
    )
