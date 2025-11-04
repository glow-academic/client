"""Permissions utilities for v3 API.

Extracted from app.services.permissions_service to remove v2 dependencies.
"""

from typing import Literal

# Profile role type (matches database enum)
ProfileRole = Literal["guest", "ta", "instructional", "admin", "superadmin"]


def get_available_subsections_for_role(role: ProfileRole) -> list[str]:
    """
    Get all available subsections for a role.

    Args:
        role: User role

    Returns:
        List of subsection identifiers available to the role
    """
    role_map = {
        "superadmin": ["home", "analytics", "practice", "management", "system", "create"],
        "admin": ["home", "analytics", "practice", "management", "system", "create"],
        "instructional": ["home", "practice", "analytics", "management", "create"],
        "ta": ["home", "practice"],
        "guest": ["practice"],
    }
    return role_map.get(role, [])


def get_redirect_path_for_role(role: ProfileRole) -> str:
    """
    Get the redirect path for a user when access is denied.

    Args:
        role: User role

    Returns:
        Redirect path for the role
    """
    redirect_map = {
        "guest": "/home",  # Guest users start at home
        "ta": "/home",  # TA users start at home
        "instructional": "/home",  # Instructional staff starts at home
        "admin": "/home",  # Admins start at home
        "superadmin": "/home",  # Superadmins start at home
    }
    return redirect_map.get(role, "/home")  # Default fallback to home

