"""Simulation permissions - Business logic for access control and permissions.

This module extracts permission computation from SQL into Python,
following the two-pass architecture pattern.
"""

from uuid import UUID


# =============================================================================
# Access Control
# =============================================================================


def has_access(
    user_role: str | None,
    user_department_ids: list[UUID] | None,
    simulation_department_ids: list[UUID] | None,
) -> bool:
    """Check if user has access to the simulation.

    Args:
        user_role: User's role (superadmin, admin, staff, learner)
        user_department_ids: List of department IDs user belongs to
        simulation_department_ids: List of department IDs simulation belongs to

    Returns:
        True if user has access to the simulation
    """
    # Superadmins have access to everything
    if user_role == "superadmin":
        return True

    # If simulation has no departments, it's accessible to all
    if not simulation_department_ids:
        return True

    # If user has no departments, they only get access to non-department simulations
    if not user_department_ids:
        return False

    # Check if user shares any department with the simulation
    user_dept_set = set(user_department_ids)
    sim_dept_set = set(simulation_department_ids)
    return bool(user_dept_set & sim_dept_set)


# =============================================================================
# Edit Permissions
# =============================================================================


def compute_can_edit(
    user_role: str | None,
    simulation_department_ids: list[UUID] | None,
    cohort_usage_count: int | None,
) -> bool:
    """Compute whether user can edit the simulation.

    Args:
        user_role: User's role
        simulation_department_ids: Simulation's department IDs
        cohort_usage_count: Number of cohorts using this simulation

    Returns:
        True if user can edit the simulation
    """
    # Learners cannot edit
    if user_role == "learner":
        return False

    # Superadmins and admins can always edit
    if user_role in ("superadmin", "admin"):
        return True

    # Staff can edit if simulation is not used by any cohorts
    usage_count = cohort_usage_count or 0
    return usage_count == 0


def compute_disabled_reason(
    user_role: str | None,
    simulation_department_ids: list[UUID] | None,
    cohort_usage_count: int | None,
) -> str | None:
    """Compute reason why editing is disabled.

    Args:
        user_role: User's role
        simulation_department_ids: Simulation's department IDs
        cohort_usage_count: Number of cohorts using this simulation

    Returns:
        Reason string if editing is disabled, None otherwise
    """
    if user_role == "learner":
        return "Learners cannot edit simulations"

    usage_count = cohort_usage_count or 0
    if user_role == "staff" and usage_count > 0:
        return f"Simulation is used by {usage_count} cohort(s). Only admins can edit."

    return None


# =============================================================================
# List Permissions
# =============================================================================


def compute_can_delete(
    user_role: str | None,
    simulation_department_ids: list[UUID] | None,
    cohort_usage_count: int | None,
) -> bool:
    """Compute whether user can delete the simulation.

    Args:
        user_role: User's role
        simulation_department_ids: Simulation's department IDs
        cohort_usage_count: Number of cohorts using this simulation

    Returns:
        True if user can delete the simulation
    """
    # Only admins, instructional, and superadmins can delete
    if user_role not in ("superadmin", "admin", "instructional"):
        return False

    # Cannot delete if used by cohorts
    usage_count = cohort_usage_count or 0
    return usage_count == 0


def compute_can_duplicate(user_role: str | None) -> bool:
    """Compute whether user can duplicate simulations.

    Args:
        user_role: User's role

    Returns:
        True if user can duplicate simulations
    """
    # Everyone except learners can duplicate
    return user_role != "learner"


# =============================================================================
# Save/Create Permissions
# =============================================================================


def compute_can_create(
    user_role: str | None,
    department_ids: list[UUID] | None,
) -> bool:
    """Compute whether user can create a new simulation.

    Args:
        user_role: User's role
        department_ids: Department IDs for the new simulation

    Returns:
        True if user can create the simulation
    """
    # Learners cannot create
    if user_role == "learner":
        return False

    # Superadmins and admins can always create
    if user_role in ("superadmin", "admin"):
        return True

    # Staff can create if they have department access
    return bool(department_ids)


def compute_can_save(
    user_role: str | None,
    user_department_ids: list[UUID] | None,
    simulation_department_ids: list[UUID] | None,
    cohort_usage_count: int | None,
) -> bool:
    """Compute whether user can save/update the simulation.

    Args:
        user_role: User's role
        user_department_ids: User's department IDs
        simulation_department_ids: Simulation's department IDs
        cohort_usage_count: Number of cohorts using this simulation

    Returns:
        True if user can save the simulation
    """
    # Must have access first
    if not has_access(user_role, user_department_ids, simulation_department_ids):
        return False

    # Then check edit permission
    return compute_can_edit(user_role, simulation_department_ids, cohort_usage_count)


# =============================================================================
# Draft Permissions
# =============================================================================


def compute_can_draft(user_role: str | None) -> bool:
    """Compute whether user can create/modify drafts.

    Args:
        user_role: User's role

    Returns:
        True if user can work with drafts
    """
    # Everyone except learners can use drafts
    return user_role != "learner"


# =============================================================================
# UI Show Flags
# =============================================================================


def compute_show_name(names_has_tools: bool | None) -> bool:
    """Compute whether to show name field.

    Args:
        names_has_tools: Whether names tools exist

    Returns:
        True if name field should be shown
    """
    return names_has_tools is True


def compute_show_description() -> bool:
    """Compute whether to show description field.

    Returns:
        Always True - description is always shown
    """
    return True


def compute_show_departments(departments_count: int | None) -> bool:
    """Compute whether to show departments field.

    Args:
        departments_count: Number of available departments

    Returns:
        True if departments field should be shown
    """
    count = departments_count or 0
    return count > 0


def compute_show_flag() -> bool:
    """Compute whether to show flag field.

    Returns:
        Always True - flag is always shown
    """
    return True


def compute_show_scenarios(scenarios_count: int | None) -> bool:
    """Compute whether to show scenarios field.

    Args:
        scenarios_count: Number of available scenarios

    Returns:
        True if scenarios field should be shown
    """
    count = scenarios_count or 0
    return count > 0


# =============================================================================
# Required Flags
# =============================================================================


def compute_name_required() -> bool:
    """Compute whether name is required.

    Returns:
        Always True - name is always required
    """
    return True


def compute_description_required() -> bool:
    """Compute whether description is required.

    Returns:
        Always False - description is optional
    """
    return False


def compute_departments_required() -> bool:
    """Compute whether departments are required.

    Returns:
        Always False - departments are optional
    """
    return False


def compute_flag_required() -> bool:
    """Compute whether flag is required.

    Returns:
        Always False - flag is optional
    """
    return False


def compute_scenarios_required() -> bool:
    """Compute whether scenarios are required.

    Returns:
        Always True - at least one scenario is needed
    """
    return True


# =============================================================================
# Missing Tools Check
# =============================================================================


def get_missing_tools(
    names_has_tools: bool | None,
    descriptions_has_tools: bool | None,
    flags_has_tools: bool | None,
    departments_has_tools: bool | None,
    scenarios_has_tools: bool | None,
) -> list[str]:
    """Get list of missing tools.

    Args:
        names_has_tools: Whether names tools exist
        descriptions_has_tools: Whether descriptions tools exist
        flags_has_tools: Whether flags tools exist
        departments_has_tools: Whether departments tools exist
        scenarios_has_tools: Whether scenarios tools exist

    Returns:
        List of missing tool names
    """
    missing = []

    if not names_has_tools:
        missing.append("names")
    if not descriptions_has_tools:
        missing.append("descriptions")
    if not flags_has_tools:
        missing.append("flags")
    if not departments_has_tools:
        missing.append("departments")
    if not scenarios_has_tools:
        missing.append("scenarios")

    return missing
