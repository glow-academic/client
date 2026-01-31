"""Cohort permission functions - business logic extracted from SQL.

These functions compute permissions for cohort operations based on user role,
department membership, and cohort usage.
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
    "COHORT_RESOURCES",
    "COHORT_BASIC_RESOURCES",
    # Permission functions
    "compute_can_edit",
    "compute_disabled_reason",
    "has_access",
    # UI show flags
    "compute_show_name",
    "compute_show_description",
    "compute_show_flag",
    "compute_show_departments",
    "compute_show_simulations",
    "compute_show_simulation_positions",
    # Required field flags
    "compute_name_required",
    "compute_description_required",
    "compute_flag_required",
    "compute_departments_required",
    "compute_simulations_required",
    "compute_simulation_positions_required",
]

# ========== Agent Scoring - Cohort-specific Constants ==========

# Cohort-specific resource definitions (hardcoded, rarely changes)
COHORT_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "flags",
    "departments",
    "simulations",
}

# Multi-resource agent definitions for cohort
COHORT_BASIC_RESOURCES: set[str] = {"names", "descriptions", "flags", "departments"}

# =============================================================================
# Core Permission Functions
# =============================================================================


def compute_can_edit(
    user_role: str,
    cohort_department_ids: list[UUID] | None,
) -> bool:
    """Compute if user can edit the cohort.

    Rules:
    - superadmin: can always edit
    - admin: can edit if cohort has departments (not a default cohort)
    - instructional/member/guest: cannot edit cohorts

    Key difference from personas: cohorts only allow admin/superadmin to edit.
    """
    if user_role == "superadmin":
        return True

    # Default cohorts (no departments) can only be edited by superadmin
    if cohort_department_ids is None or len(cohort_department_ids) == 0:
        return False

    if user_role == "admin":
        return True

    return False


def compute_can_delete(
    user_role: str,
    cohort_department_ids: list[UUID] | None,
    usage_count: int,
) -> bool:
    """Compute if user can delete the cohort.

    Rules:
    - Must have edit permission
    - Cannot delete if usage_count > 0 (has linked profiles with attempts)
    """
    if not compute_can_edit(user_role, cohort_department_ids):
        return False

    return usage_count == 0


def compute_can_duplicate(user_role: str) -> bool:
    """Compute if user can duplicate the cohort.

    Rules:
    - All authenticated users can duplicate cohorts
    """
    return True


def compute_can_leave(is_member: bool) -> bool:
    """Compute if user can leave the cohort.

    Rules:
    - User can leave if they are a member of the cohort
    """
    return is_member


def compute_disabled_reason(
    user_role: str,
    cohort_department_ids: list[UUID] | None,
) -> str | None:
    """Compute the disabled reason for editing a cohort.

    Returns None if editing is allowed, otherwise returns a message.
    """
    if user_role == "superadmin":
        return None

    # Default cohorts (no departments)
    if cohort_department_ids is None or len(cohort_department_ids) == 0:
        return "This is a default cohort that cannot be edited."

    if user_role in ("admin",):
        return None

    return "This cohort cannot be edited."


def has_access(
    user_role: str,
    user_department_ids: list[UUID],
    cohort_department_ids: list[UUID] | None,
) -> bool:
    """Check if user has access to view the cohort.

    Rules:
    - superadmin: can access all cohorts
    - Other roles: can access if cohort has no departments (default) or
      shares at least one department with user
    """
    if user_role == "superadmin":
        return True

    # Default cohorts (no departments) are accessible to all
    if cohort_department_ids is None or len(cohort_department_ids) == 0:
        return True

    # Check for department overlap
    user_dept_set = set(user_department_ids)
    cohort_dept_set = set(cohort_department_ids)

    return len(user_dept_set & cohort_dept_set) > 0


# =============================================================================
# UI Visibility Flags
# =============================================================================


def compute_show_name() -> bool:
    """Name is always shown."""
    return True


def compute_show_description() -> bool:
    """Description is always shown."""
    return True


def compute_show_flag() -> bool:
    """Flag (active status) is always shown."""
    return True


def compute_show_departments(departments_count: int) -> bool:
    """Show departments section if there are departments available."""
    return departments_count > 0


def compute_show_simulations(simulations_count: int) -> bool:
    """Show simulations section if there are simulations available."""
    return simulations_count > 0


def compute_show_simulation_positions(simulation_positions_count: int) -> bool:
    """Show simulation positions section if there are positions."""
    return simulation_positions_count > 0


# =============================================================================
# Required Field Flags
# =============================================================================


def compute_name_required() -> bool:
    """Name is always required."""
    return True


def compute_description_required() -> bool:
    """Description is optional."""
    return False


def compute_flag_required() -> bool:
    """Flag is optional."""
    return False


def compute_departments_required(show_departments: bool) -> bool:
    """Departments are required if the section is shown."""
    return show_departments


def compute_simulations_required() -> bool:
    """Simulations are optional."""
    return False


def compute_simulation_positions_required() -> bool:
    """Simulation positions are optional."""
    return False


# =============================================================================
# Validation Helpers
# =============================================================================


def get_missing_tools(
    names_has_tools: bool,
    departments_has_tools: bool,
    show_departments: bool,
) -> list[str]:
    """Get list of required resources that are missing tools.

    Returns list of resource names that need tools but don't have them.
    """
    missing: list[str] = []

    if not names_has_tools:
        missing.append("name")

    if show_departments and not departments_has_tools:
        missing.append("departments")

    return missing


# =============================================================================
# Save/Create Permissions
# =============================================================================


def compute_can_create(
    user_role: str,
    department_ids: list[UUID] | None,
) -> bool:
    """Compute if user can create a new cohort.

    Rules:
    - superadmin: can always create
    - admin: can create if at least one department is specified
    - Other roles: cannot create cohorts
    """
    if user_role == "superadmin":
        return True

    if user_role == "admin":
        # Must have at least one department
        return department_ids is not None and len(department_ids) > 0

    return False


def compute_can_save(
    user_role: str,
    user_department_ids: list[UUID],
    cohort_department_ids: list[UUID] | None,
) -> bool:
    """Compute if user can save changes to an existing cohort.

    This combines access check with edit permission.
    """
    if not has_access(user_role, user_department_ids, cohort_department_ids):
        return False

    return compute_can_edit(user_role, cohort_department_ids)


def compute_can_draft(user_role: str) -> bool:
    """Compute if user can create/update a draft.

    Rules:
    - All authenticated users can create drafts (drafts are auto-saved)
    - The actual save operation will validate permissions
    """
    return True
