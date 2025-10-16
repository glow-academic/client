"""
Permissions service for route access control.
Ported from client/utils/route-permissions.ts
"""

import re
from typing import List, Optional

from app.schemas.permissions import (ROUTE_PERMISSIONS, ProfileRole,
                                     RoutePermission, SectionPermission)


class PermissionsService:
    """Service for handling route permissions and access control."""

    @staticmethod
    def normalize_path_for_matching(pathname: str) -> str:
        """
        Normalize path for matching (handles dynamic segments).

        Args:
            pathname: Original pathname (e.g., "/cohorts/c/abc-123")

        Returns:
            Normalized path with dynamic segments replaced (e.g., "cohorts/c/[id]")
        """
        # Remove leading slash and normalize
        normalized = pathname[1:] if pathname.startswith("/") else pathname

        # Convert dynamic segments to pattern format
        # Replace UUID-like segments or any segment that looks like an ID
        normalized = re.sub(r"/[a-f0-9-]{8,}", "/[id]", normalized)
        normalized = re.sub(r"/[a-zA-Z0-9_-]{20,}", "/[id]", normalized)

        return normalized

    @staticmethod
    def route_matches(pattern: str, normalized_path: str) -> bool:
        """
        Check if a route pattern matches a normalized path.

        Args:
            pattern: Route pattern (e.g., "/cohorts/c/[cohortId]")
            normalized_path: Normalized path (e.g., "cohorts/c/[id]")

        Returns:
            True if the pattern matches the path
        """
        # Remove leading slash from pattern
        clean_pattern = pattern[1:] if pattern.startswith("/") else pattern

        # Convert pattern to regex
        # Replace [anything] with regex that matches any non-slash characters
        regex_pattern = re.sub(r"\[[^\]]+\]", "[^/]+", clean_pattern)
        # Escape forward slashes
        regex_pattern = regex_pattern.replace("/", r"\/")

        # Match the pattern
        regex = re.compile(f"^{regex_pattern}$")
        return bool(regex.match(normalized_path))

    @staticmethod
    def has_route_access(pathname: str, role: ProfileRole) -> bool:
        """
        Check if a user has access to a specific path.

        Args:
            pathname: Route pathname (e.g., "/analytics/dashboard")
            role: User role

        Returns:
            True if the user has access to the route
        """
        # Handle dynamic routes by converting them to pattern matches
        normalized_path = PermissionsService.normalize_path_for_matching(pathname)

        for section in ROUTE_PERMISSIONS:
            for route in section.routes:
                if (
                    PermissionsService.route_matches(route.path, normalized_path)
                    and role in route.roles
                ):
                    return True

        return False

    @staticmethod
    def get_route_permission(pathname: str) -> Optional[RoutePermission]:
        """
        Get route permission for a specific path.

        Args:
            pathname: Route pathname

        Returns:
            RoutePermission if found, None otherwise
        """
        normalized_path = PermissionsService.normalize_path_for_matching(pathname)

        for section in ROUTE_PERMISSIONS:
            for route in section.routes:
                if PermissionsService.route_matches(route.path, normalized_path):
                    return route

        return None

    @staticmethod
    def get_section_permission(pathname: str) -> Optional[SectionPermission]:
        """
        Get section permission for a specific path.

        Args:
            pathname: Route pathname

        Returns:
            SectionPermission if found, None otherwise
        """
        normalized_path = PermissionsService.normalize_path_for_matching(pathname)

        for section in ROUTE_PERMISSIONS:
            for route in section.routes:
                if PermissionsService.route_matches(route.path, normalized_path):
                    return section

        return None

    @staticmethod
    def get_redirect_path_for_role(role: ProfileRole) -> str:
        """
        Get the redirect path for a user when access is denied.

        Args:
            role: User role

        Returns:
            Redirect path for the role
        """
        redirect_map = {
            "guest": "/practice",  # Guest users can access practice
            "ta": "/home",  # TA users start at home
            "instructional": "/analytics/dashboard",  # Instructional staff starts at analytics
            "admin": "/analytics/dashboard",  # Admins start at analytics dashboard
            "superadmin": "/analytics/dashboard",  # Superadmins start at analytics dashboard
        }

        return redirect_map.get(role, "/home")  # Default fallback to home

    @staticmethod
    def get_available_sections_for_role(role: ProfileRole) -> List[str]:
        """
        Get all available sections for a role.

        Args:
            role: User role

        Returns:
            List of section identifiers available to the role
        """
        sections = set()

        for section in ROUTE_PERMISSIONS:
            if role in section.roles:
                sections.add(section.section)

        return sorted(list(sections))

    @staticmethod
    def get_available_subsections_for_role(role: ProfileRole) -> List[str]:
        """
        Get all available subsections for a role (including individual route sections).

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

    @staticmethod
    def is_section_available_for_role(section: str, role: ProfileRole) -> bool:
        """
        Check if a section is available for a role.

        Args:
            section: Section identifier
            role: User role

        Returns:
            True if the section is available to the role
        """
        return section in PermissionsService.get_available_sections_for_role(role)

    @staticmethod
    def get_first_available_section_for_role(role: ProfileRole) -> str:
        """
        Get the first available section for a role.

        Args:
            role: User role

        Returns:
            First available section identifier
        """
        available_sections = PermissionsService.get_available_sections_for_role(role)

        if not available_sections:
            return "home"

        # Priority order for first section
        priority_order = [
            "home",
            "dashboard",
            "analytics",
            "create",
            "management",
            "system",
        ]

        for priority in priority_order:
            if priority in available_sections:
                return priority

        return available_sections[0] if available_sections else "home"


# Singleton instance for easy access
permissions_service = PermissionsService()

