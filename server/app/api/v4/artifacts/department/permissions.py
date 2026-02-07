"""Department permission helpers.

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
    "DEPARTMENT_RESOURCES",
    "DEPARTMENT_BASIC_RESOURCES",
    "DEPARTMENT_SETTINGS_RESOURCES",
]


def compute_can_edit(
    user_role: str | None,
    usage_count: int,
) -> bool:
    """Unified can_edit logic for both get and list views.

    Constraints:
    1. Not in use by entities (unless superadmin)
    2. User has admin/instructional/superadmin role
    """
    # Departments in use cannot be edited (except by superadmin)
    if usage_count > 0 and user_role != "superadmin":
        return False

    # Role check
    return user_role in ("admin", "instructional", "superadmin")


def compute_disabled_reason(
    user_role: str | None,
    usage_count: int,
) -> str | None:
    """Compute the reason why editing is disabled, if any.

    Returns None if editing is allowed.
    """
    # Departments in use cannot be edited
    if usage_count > 0 and user_role != "superadmin":
        return (
            "This department is currently in use and cannot be edited. "
            "You can view the details but cannot make changes."
        )

    # Role check
    if user_role not in ("admin", "instructional", "superadmin"):
        return (
            "This department cannot be edited. "
            "You can view the details but cannot make changes."
        )

    return None


def get_missing_tools(
    names_has_tools: bool,
    show_settings: bool,
    settings_has_tools: bool,
) -> list[str]:
    """Get list of missing required tools."""
    missing = []

    if not names_has_tools:
        missing.append("name")
    if show_settings and not settings_has_tools:
        missing.append("settings")

    return missing


def has_access(
    user_role: str | None,
) -> bool:
    """Check if user has access to view departments.

    Access rules:
    - Departments are accessible to all members and above
    """
    return user_role in ("member", "admin", "instructional", "superadmin")


def compute_show_name(names_has_tools: bool) -> bool:
    """Determine if name picker should be shown."""
    return names_has_tools


def compute_show_description() -> bool:
    """Determine if description picker should be shown."""
    return True


def compute_show_flag() -> bool:
    """Determine if flag toggle should be shown."""
    return True


def compute_show_settings(settings_count: int) -> bool:
    """Determine if settings picker should be shown."""
    return settings_count > 0


def compute_name_required() -> bool:
    """Determine if name is required."""
    return True


def compute_description_required() -> bool:
    """Determine if description is required."""
    return False


def compute_flag_required() -> bool:
    """Determine if flag is required."""
    return False


def compute_settings_required() -> bool:
    """Determine if settings is required."""
    return False


# ========== List Endpoint Permission Functions ==========


def compute_can_delete(
    user_role: str | None,
    total_usage: int,
) -> bool:
    """Compute can_delete permission.

    Business logic:
    - Departments with any entity links cannot be deleted
    - Only admins, instructional, and superadmins can delete
    """
    if total_usage > 0:
        return False

    return user_role in ("admin", "instructional", "superadmin")


def compute_can_duplicate(user_role: str | None) -> bool:
    """Compute can_duplicate permission.

    Business logic:
    - Anyone with edit permissions can duplicate
    """
    return user_role in ("admin", "instructional", "superadmin")


# ========== Save/Create Endpoint Permission Functions ==========


def compute_can_create(user_role: str | None) -> bool:
    """Compute permission to create a new department.

    Business logic:
    - Only admin/instructional/superadmin can create departments
    """
    return user_role in ("admin", "instructional", "superadmin")


def compute_can_save(
    user_role: str | None,
    usage_count: int,
) -> bool:
    """Compute permission to save/update an existing department.

    Business logic:
    - Departments in use cannot be edited (except by superadmin)
    - Only admin/instructional/superadmin can save
    """
    if user_role not in ("admin", "instructional", "superadmin"):
        return False

    if usage_count > 0 and user_role != "superadmin":
        return False

    return True


# ========== Draft Endpoint Permission Functions ==========


def compute_can_draft(user_role: str | None) -> bool:
    """Compute permission to create or update a draft.

    Business logic:
    - Only admin/instructional/superadmin can create/edit drafts
    """
    return user_role in ("admin", "instructional", "superadmin")


# ========== Agent Scoring - Department-specific Constants ==========

DEPARTMENT_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "flags",
    "settings",
}

DEPARTMENT_BASIC_RESOURCES: set[str] = {"names", "descriptions", "flags"}
DEPARTMENT_SETTINGS_RESOURCES: set[str] = {"settings"}


# ========== Domain Metadata - for client-side display in modals ==========

DEPARTMENT_DOMAIN_METADATA: dict[str, dict[str, str | bool]] = {
    "names": {
        "name": "Name",
        "description": "The display name for this department",
        "icon": "building",
    },
    "descriptions": {
        "name": "Description",
        "description": "A brief description of this department",
        "icon": "file-text",
    },
    "flags": {
        "name": "Status",
        "description": "Active/inactive status",
        "icon": "flag",
    },
    "settings": {
        "name": "Settings",
        "description": "Configuration settings for this department",
        "icon": "settings",
    },
}


def build_domain_data(
    domain_ids: dict[str, UUID | None],
    show_flags: dict[str, bool],
    required_flags: dict[str, bool],
) -> list:
    """Build rich domain metadata for client display.

    Delegates to shared build_domain_data with department-specific metadata.
    """
    from app.api.v4.types import build_domain_data as _build_domain_data

    return _build_domain_data(
        domain_ids, show_flags, required_flags, DEPARTMENT_DOMAIN_METADATA
    )
