"""Permissions utilities for v3 API.

Extracted from app.services.permissions_service to remove v2 dependencies.
"""

from typing import Literal

from app.schemas.permissions import ROUTE_PERMISSIONS

# Profile role type (matches database enum)
ProfileRole = Literal["guest", "ta", "instructional", "admin", "superadmin"]


def get_available_subsections_for_role(role: ProfileRole) -> list[str]:
    """
    Get all available subsections for a role (including individual route sections).
    
    This extracts subsections from ROUTE_PERMISSIONS, matching the behavior
    of PermissionsService.get_available_subsections_for_role in v2.

    Args:
        role: User role

    Returns:
        List of subsection identifiers available to the role
    """
    subsections = set()

    for section in ROUTE_PERMISSIONS:
        if role in section.roles:
            # Add the main section
            subsections.add(section.section)

            # Add all subsections from routes
            for route in section.routes:
                # Extract subsection from route path
                path_parts = [p for p in route.path.split("/") if p]
                if len(path_parts) >= 2:
                    # For paths like "/analytics/dashboard", add "dashboard"
                    # For paths like "/create/personas", add "personas"
                    subsections.add(path_parts[1])

    return sorted(list(subsections))


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

