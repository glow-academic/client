"""Field permission helpers.

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
    "FIELD_RESOURCES",
    "FIELD_BASIC_RESOURCES",
    "FIELD_GENERAL_RESOURCES",
]


def compute_can_edit(
    user_role: str | None,
    field_department_ids: list[str] | list[UUID] | None,
) -> bool:
    """Unified can_edit logic for both get and list views.

    Constraints:
    1. Not a default field (unless superadmin)
    2. User has admin/superadmin role
    """
    # Default fields can only be edited by superadmin
    if not field_department_ids and user_role != "superadmin":
        return False

    # Role check
    return user_role in ("admin", "superadmin")


def compute_disabled_reason(
    user_role: str | None,
    field_department_ids: list[str] | list[UUID] | None,
) -> str | None:
    """Compute the reason why editing is disabled, if any.

    Returns None if editing is allowed.
    """
    # Default fields can only be edited by superadmin
    if not field_department_ids and user_role != "superadmin":
        return (
            "This is a default field that cannot be edited. "
            "You can view the details but cannot make changes."
        )

    # Role check
    if user_role not in ("admin", "superadmin"):
        return (
            "This field cannot be edited. "
            "You can view the details but cannot make changes."
        )

    return None


def has_access(
    user_role: str | None,
    user_department_ids: list[UUID] | None,
    field_department_ids: list[UUID] | None,
) -> bool:
    """Check if user has access to view the field.

    Access rules:
    - Superadmin has access to all fields
    - User has access if field has no departments (default field)
    - User has access if they share at least one department with the field
    """
    if user_role == "superadmin":
        return True

    # Default fields (no departments) are accessible to all
    if not field_department_ids:
        return True

    # Check department overlap
    if not user_department_ids:
        return False

    user_dept_set = set(user_department_ids)
    field_dept_set = set(field_department_ids)
    return bool(user_dept_set & field_dept_set)


def compute_show_name(names_has_tools: bool) -> bool:
    """Determine if name picker should be shown."""
    return names_has_tools


def compute_show_description() -> bool:
    """Determine if description picker should be shown."""
    return True


def compute_show_flag() -> bool:
    """Determine if flag toggle should be shown."""
    return True


def compute_show_departments(departments_count: int) -> bool:
    """Determine if departments picker should be shown."""
    return departments_count > 0


def compute_show_conditional_parameters(conditional_parameters_count: int) -> bool:
    """Determine if conditional parameters picker should be shown."""
    return conditional_parameters_count > 0


def compute_name_required() -> bool:
    """Determine if name is required."""
    return True


def compute_description_required() -> bool:
    """Determine if description is required."""
    return False


def compute_flag_required() -> bool:
    """Determine if flag is required."""
    return False


def compute_departments_required() -> bool:
    """Determine if departments is required."""
    return False


def compute_conditional_parameters_required() -> bool:
    """Determine if conditional parameters is required."""
    return False


# ========== List Endpoint Permission Functions ==========


def compute_can_delete(
    user_role: str | None,
    field_department_ids: list[str] | None,
    total_parameter_links: int,
) -> bool:
    """Compute can_delete permission.

    Business logic:
    - Default fields (no departments) cannot be deleted except by superadmin
    - Fields linked to parameters cannot be deleted
    - Only admins and superadmins can delete
    """
    # Default fields can only be deleted by superadmin
    if not field_department_ids and user_role != "superadmin":
        return False

    # Fields with parameter links cannot be deleted
    if total_parameter_links > 0:
        return False

    # Only admins and superadmins can delete
    return user_role in ("admin", "superadmin")


def compute_can_duplicate(user_role: str | None) -> bool:
    """Compute can_duplicate permission.

    Business logic:
    - Anyone with edit permissions can duplicate
    - Currently always true for admin/superadmin
    """
    return user_role in ("admin", "superadmin")


# ========== Save/Create Endpoint Permission Functions ==========


def compute_can_create(
    user_role: str | None,
    department_ids: list[str] | list[UUID] | None,
) -> bool:
    """Compute permission to create a new field.

    Business logic:
    - Non-superadmins cannot create general objects (empty department_ids)
    - Only admin/superadmin can create fields
    """
    # Role check first
    if user_role not in ("admin", "superadmin"):
        return False

    # Non-superadmins cannot create general objects (no departments)
    if user_role != "superadmin" and not department_ids:
        return False

    return True


def compute_can_save(
    user_role: str | None,
    user_department_ids: list[str] | list[UUID] | None,
    field_department_ids: list[str] | list[UUID] | None,
) -> bool:
    """Compute permission to save/update an existing field.

    Business logic:
    - Not a default field (unless superadmin)
    - User has admin/superadmin role
    - Non-superadmins must belong to ALL of the field's departments
    """
    # Role check first
    if user_role not in ("admin", "superadmin"):
        return False

    # Default fields can only be edited by superadmin
    if not field_department_ids and user_role != "superadmin":
        return False

    # Non-superadmins must belong to ALL of the field's departments
    if user_role != "superadmin" and field_department_ids:
        if not user_department_ids:
            return False
        # Convert to sets of strings for comparison
        user_dept_set = {str(d) for d in user_department_ids}
        field_dept_set = {str(d) for d in field_department_ids}
        # User must have ALL field departments
        if not field_dept_set.issubset(user_dept_set):
            return False

    return True


# ========== Draft Endpoint Permission Functions ==========


def compute_can_draft(user_role: str | None) -> bool:
    """Compute permission to create or update a draft.

    Business logic:
    - Only admin/superadmin can create/edit drafts
    """
    return user_role in ("admin", "superadmin")


# ========== Agent Scoring - Field-specific Constants ==========

# Field-specific resource definitions
FIELD_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "flags",
    "departments",
    "conditional_parameters",
}

# Multi-resource agent definitions for field
FIELD_BASIC_RESOURCES: set[str] = {"names", "descriptions", "flags", "departments"}
FIELD_GENERAL_RESOURCES: set[str] = FIELD_RESOURCES  # All resources
