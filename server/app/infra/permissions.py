"""Permissions utilities for v4 API.

Re-exports from the canonical location in app.routes.auth.route_permissions.
"""

from app.routes.auth.route_permissions import (  # noqa: F401
    ROUTE_PERMISSIONS,
    ProfileRole,
    RoutePermission,
    SectionPermission,
    get_available_subsections_for_role,
    get_redirect_path_for_role,
)

__all__ = [
    "ROUTE_PERMISSIONS",
    "ProfileRole",
    "RoutePermission",
    "SectionPermission",
    "get_available_subsections_for_role",
    "get_redirect_path_for_role",
]
