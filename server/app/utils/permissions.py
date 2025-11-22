"""Permissions utilities for v3 API."""

from typing import Literal

from pydantic import BaseModel, Field

# Profile role type (matches database enum)
ProfileRole = Literal["guest", "ta", "instructional", "admin", "superadmin"]


class RoutePermission(BaseModel):
    """Route permission configuration."""

    path: str = Field(..., description="Route path with dynamic segments like [id]")
    roles: list[ProfileRole] = Field(
        ..., description="Roles allowed to access this route"
    )
    title: str = Field(..., description="Human-readable route title")
    description: str | None = Field(default=None, description="Route description")
    redirectTo: str | None = Field(
        default=None, description="Where to redirect if access denied"
    )

    class Config:
        populate_by_name = True


class SectionPermission(BaseModel):
    """Section permission configuration with nested routes."""

    section: str = Field(..., description="Section identifier")
    roles: list[ProfileRole] = Field(
        ..., description="Roles allowed to access this section"
    )
    title: str = Field(..., description="Human-readable section title")
    description: str | None = Field(default=None, description="Section description")
    routes: list[RoutePermission] = Field(..., description="Routes within this section")

    class Config:
        populate_by_name = True


# Centralized route permissions configuration
ROUTE_PERMISSIONS: list[SectionPermission] = [
    SectionPermission(
        section="home",
        roles=["ta", "instructional", "admin", "superadmin"],
        title="Home",
        description="Main dashboard for TA users",
        routes=[
            RoutePermission(
                path="/home",
                roles=["ta", "instructional", "admin", "superadmin"],
                title="Home Dashboard",
                redirectTo="/home",
            ),
            RoutePermission(
                path="/home/a/[attemptId]",
                roles=["ta", "instructional", "admin", "superadmin"],
                title="Simulation Attempt",
                redirectTo="/home",
            ),
        ],
    ),
    SectionPermission(
        section="practice",
        roles=["guest", "ta", "instructional", "admin", "superadmin"],
        title="Practice",
        description="Practice simulations for all users",
        routes=[
            RoutePermission(
                path="/practice",
                roles=["guest", "ta", "instructional", "admin", "superadmin"],
                title="Practice Zone",
                redirectTo="/practice",
            ),
            RoutePermission(
                path="/practice/a/[attemptId]",
                roles=["guest", "ta", "instructional", "admin", "superadmin"],
                title="Practice Attempt",
                redirectTo="/practice",
            ),
        ],
    ),
    SectionPermission(
        section="analytics",
        roles=["instructional", "admin", "superadmin"],
        title="Analytics",
        description="Analytics and reporting tools",
        routes=[
            RoutePermission(
                path="/analytics",
                roles=["instructional", "admin", "superadmin"],
                title="Analytics Overview",
                redirectTo="/analytics/dashboard",
            ),
            RoutePermission(
                path="/analytics/dashboard",
                roles=["instructional", "admin", "superadmin"],
                title="Analytics Dashboard",
                redirectTo="/analytics/dashboard",
            ),
            RoutePermission(
                path="/analytics/reports",
                roles=["instructional", "admin", "superadmin"],
                title="Analytics Reports",
                redirectTo="/analytics/reports",
            ),
            RoutePermission(
                path="/analytics/leaderboard",
                roles=["instructional", "admin", "superadmin"],
                title="Leaderboard",
                redirectTo="/analytics/leaderboard",
            ),
            RoutePermission(
                path="/analytics/reports/p/[profileId]",
                roles=["instructional", "admin", "superadmin"],
                title="Profile Report",
                redirectTo="/analytics/reports",
            ),
            RoutePermission(
                path="/analytics/pricing",
                roles=["admin", "superadmin"],
                title="Pricing",
                redirectTo="/analytics/pricing",
            ),
        ],
    ),
    SectionPermission(
        section="departments",
        roles=["instructional", "admin", "superadmin"],
        title="Departments",
        description="Department management",
        routes=[
            RoutePermission(
                path="/departments",
                roles=["instructional", "admin", "superadmin"],
                title="Departments",
                redirectTo="/departments",
            ),
            RoutePermission(
                path="/departments/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Department",
                redirectTo="/departments",
            ),
            RoutePermission(
                path="/departments/d/[departmentId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Department",
                redirectTo="/departments",
            ),
        ],
    ),
    SectionPermission(
        section="cohorts",
        roles=["ta", "instructional", "admin", "superadmin"],
        title="Cohorts",
        description="Cohort management and viewing",
        routes=[
            RoutePermission(
                path="/cohorts",
                roles=["instructional", "admin", "superadmin"],
                title="Cohorts Management",
                redirectTo="/cohorts",
            ),
            RoutePermission(
                path="/cohorts/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Cohort",
                redirectTo="/cohorts",
            ),
            RoutePermission(
                path="/cohorts/c/[cohortId]",
                roles=["ta", "instructional", "admin", "superadmin"],
                title="View Cohort",
                redirectTo="/cohorts",
            ),
            RoutePermission(
                path="/cohorts/e/[cohortId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Cohort",
                redirectTo="/cohorts",
            ),
        ],
    ),
    SectionPermission(
        section="create",
        roles=["instructional", "admin", "superadmin"],
        title="Create",
        description="Content creation tools",
        routes=[
            RoutePermission(
                path="/create",
                roles=["instructional", "admin", "superadmin"],
                title="Create Overview",
                redirectTo="/create/personas",
            ),
            RoutePermission(
                path="/create/personas",
                roles=["instructional", "admin", "superadmin"],
                title="Personas",
                redirectTo="/create/personas",
            ),
            RoutePermission(
                path="/create/personas/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Persona",
                redirectTo="/create/personas",
            ),
            RoutePermission(
                path="/create/personas/p/[personaId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Persona",
                redirectTo="/create/personas",
            ),
            RoutePermission(
                path="/create/scenarios",
                roles=["instructional", "admin", "superadmin"],
                title="Scenarios",
                redirectTo="/create/scenarios",
            ),
            RoutePermission(
                path="/create/scenarios/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Scenario",
                redirectTo="/create/scenarios",
            ),
            RoutePermission(
                path="/create/scenarios/s/[scenarioId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Scenario",
                redirectTo="/create/scenarios",
            ),
            RoutePermission(
                path="/create/simulations",
                roles=["instructional", "admin", "superadmin"],
                title="Simulations",
                redirectTo="/create/simulations",
            ),
            RoutePermission(
                path="/create/simulations/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Simulation",
                redirectTo="/create/simulations",
            ),
            RoutePermission(
                path="/create/simulations/s/[simulationId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Simulation",
                redirectTo="/create/simulations",
            ),
            RoutePermission(
                path="/create/videos",
                roles=["instructional", "admin", "superadmin"],
                title="Videos",
                redirectTo="/create/videos",
            ),
        ],
    ),
    SectionPermission(
        section="management",
        roles=["admin", "superadmin"],
        title="Management",
        description="System management tools",
        routes=[
            RoutePermission(
                path="/management",
                roles=["admin", "superadmin"],
                title="Management Overview",
                redirectTo="/management/policies",
            ),
            RoutePermission(
                path="/management/policies",
                roles=["admin", "superadmin"],
                title="Policies",
                redirectTo="/management/policies",
            ),
            RoutePermission(
                path="/management/documents",
                roles=["admin", "superadmin"],
                title="Documents",
                redirectTo="/management/documents",
            ),
            RoutePermission(
                path="/management/documents/d/[documentId]",
                roles=["admin", "superadmin"],
                title="View Document",
                redirectTo="/management/documents",
            ),
            RoutePermission(
                path="/management/rubrics",
                roles=["admin", "superadmin"],
                title="Rubrics",
                redirectTo="/management/rubrics",
            ),
            RoutePermission(
                path="/management/rubrics/new",
                roles=["admin", "superadmin"],
                title="Create Rubric",
                redirectTo="/management/rubrics",
            ),
            RoutePermission(
                path="/management/rubrics/r/[rubricId]",
                roles=["admin", "superadmin"],
                title="Edit Rubric",
                redirectTo="/management/rubrics",
            ),
            RoutePermission(
                path="/management/parameters",
                roles=["admin", "superadmin"],
                title="Parameters",
                redirectTo="/management/parameters",
            ),
            RoutePermission(
                path="/management/parameters/new",
                roles=["admin", "superadmin"],
                title="Create Parameter",
                redirectTo="/management/parameters",
            ),
            RoutePermission(
                path="/management/parameters/p/[parameterId]",
                roles=["admin", "superadmin"],
                title="Edit Parameter",
                redirectTo="/management/parameters",
            ),
        ],
    ),
    SectionPermission(
        section="engine",
        roles=["superadmin"],
        title="Engine",
        description="Engine configuration tools",
        routes=[
            RoutePermission(
                path="/engine",
                roles=["superadmin"],
                title="Engine Overview",
                redirectTo="/engine/agents",
            ),
            RoutePermission(
                path="/engine/agents",
                roles=["superadmin"],
                title="Agents",
                redirectTo="/engine/agents",
            ),
            RoutePermission(
                path="/engine/agents/new",
                roles=["superadmin"],
                title="Create Agent",
                redirectTo="/engine/agents",
            ),
            RoutePermission(
                path="/engine/agents/a/[agentId]",
                roles=["superadmin"],
                title="Edit Agent",
                redirectTo="/engine/agents",
            ),
            RoutePermission(
                path="/engine/models",
                roles=["superadmin"],
                title="Models",
                redirectTo="/engine/models",
            ),
            RoutePermission(
                path="/engine/models/new",
                roles=["superadmin"],
                title="Create Model",
                redirectTo="/engine/models",
            ),
            RoutePermission(
                path="/engine/models/[modelId]",
                roles=["superadmin"],
                title="Edit Model",
                redirectTo="/engine/models",
            ),
            RoutePermission(
                path="/engine/providers",
                roles=["superadmin"],
                title="Providers",
                redirectTo="/engine/providers",
            ),
            RoutePermission(
                path="/engine/evals",
                roles=["superadmin"],
                title="Evals",
                redirectTo="/engine/evals",
            ),
        ],
    ),
    SectionPermission(
        section="system",
        roles=["superadmin"],
        title="System",
        description="System administration tools",
        routes=[
            RoutePermission(
                path="/system",
                roles=["superadmin"],
                title="System Overview",
                redirectTo="/system/staff",
            ),
            RoutePermission(
                path="/system/staff",
                roles=["superadmin"],
                title="Staff Management",
                redirectTo="/system/staff",
            ),
            RoutePermission(
                path="/system/staff/p/[profileId]",
                roles=["superadmin"],
                title="Staff Profile",
                redirectTo="/system/staff",
            ),
            RoutePermission(
                path="/system/authentication",
                roles=["superadmin"],
                title="Authentication",
                redirectTo="/system/authentication",
            ),
            RoutePermission(
                path="/system/logs",
                roles=["superadmin"],
                title="System Logs",
                redirectTo="/system/logs",
            ),
            RoutePermission(
                path="/system/health",
                roles=["superadmin"],
                title="Health",
                redirectTo="/system/health",
            ),
        ],
    ),
    SectionPermission(
        section="profile",
        roles=["ta", "instructional", "admin", "superadmin"],
        title="Profile",
        description="User profile management",
        routes=[
            RoutePermission(
                path="/profile",
                roles=["ta", "instructional", "admin", "superadmin"],
                title="User Profile",
                redirectTo="/profile",
            ),
        ],
    ),
]


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

    return sorted(subsections)


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
