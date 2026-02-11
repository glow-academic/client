"""Permissions utilities for v4 API."""

from typing import Literal

from pydantic import BaseModel, Field

# Profile role type (matches database enum)
ProfileRole = Literal[
    "guest", "member", "instructional", "admin", "superadmin", "custom"
]


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
        roles=["member", "instructional", "admin", "superadmin"],
        title="Home",
        description="Main dashboard for member users",
        routes=[
            RoutePermission(
                path="/home",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Home Dashboard",
                redirectTo="/home",
            ),
            RoutePermission(
                path="/home/a/[attemptId]",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Simulation Attempt",
                redirectTo="/home",
            ),
            RoutePermission(
                path="/home/b/[bundleId]",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Customize Training",
                redirectTo="/home",
            ),
        ],
    ),
    SectionPermission(
        section="practice",
        roles=["guest", "member", "instructional", "admin", "superadmin"],
        title="Practice",
        description="Practice simulations for all users",
        routes=[
            RoutePermission(
                path="/practice",
                roles=["guest", "member", "instructional", "admin", "superadmin"],
                title="Practice Zone",
                redirectTo="/practice",
            ),
            RoutePermission(
                path="/practice/a/[attemptId]",
                roles=["guest", "member", "instructional", "admin", "superadmin"],
                title="Practice Attempt",
                redirectTo="/practice",
            ),
            RoutePermission(
                path="/practice/b/[bundleId]",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Customize Practice",
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
                path="/analytics/reports/p/[profileId]",
                roles=["instructional", "admin", "superadmin"],
                title="Profile Report",
                redirectTo="/analytics/reports",
            ),
            RoutePermission(
                path="/analytics/activity",
                roles=["instructional", "admin", "superadmin"],
                title="Activity",
                redirectTo="/analytics/activity",
            ),
            RoutePermission(
                path="/analytics/pricing",
                roles=["instructional", "admin", "superadmin"],
                title="Pricing",
                redirectTo="/analytics/pricing",
            ),
            RoutePermission(
                path="/analytics/pricing/g/[groupId]",
                roles=["instructional", "admin", "superadmin"],
                title="Pricing Group",
                redirectTo="/analytics/pricing",
            ),
        ],
    ),
    SectionPermission(
        section="leaderboard",
        roles=["member", "instructional", "admin", "superadmin"],
        title="Leaderboard",
        description="Performance leaderboard and rankings",
        routes=[
            RoutePermission(
                path="/leaderboard",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Leaderboard",
                redirectTo="/leaderboard",
            ),
        ],
    ),
    SectionPermission(
        section="training",
        roles=["instructional", "admin", "superadmin"],
        title="Training",
        description="Training content tools",
        routes=[
            RoutePermission(
                path="/training",
                roles=["instructional", "admin", "superadmin"],
                title="Training Overview",
                redirectTo="/training/personas",
            ),
            RoutePermission(
                path="/training/personas",
                roles=["instructional", "admin", "superadmin"],
                title="Personas",
                redirectTo="/training/personas",
            ),
            RoutePermission(
                path="/training/personas/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Persona",
                redirectTo="/training/personas",
            ),
            RoutePermission(
                path="/training/personas/p/[personaId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Persona",
                redirectTo="/training/personas",
            ),
            RoutePermission(
                path="/training/scenarios",
                roles=["instructional", "admin", "superadmin"],
                title="Scenarios",
                redirectTo="/training/scenarios",
            ),
            RoutePermission(
                path="/training/scenarios/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Scenario",
                redirectTo="/training/scenarios",
            ),
            RoutePermission(
                path="/training/scenarios/s/[scenarioId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Scenario",
                redirectTo="/training/scenarios",
            ),
            RoutePermission(
                path="/training/simulations",
                roles=["instructional", "admin", "superadmin"],
                title="Simulations",
                redirectTo="/training/simulations",
            ),
            RoutePermission(
                path="/training/simulations/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Simulation",
                redirectTo="/training/simulations",
            ),
            RoutePermission(
                path="/training/simulations/s/[simulationId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Simulation",
                redirectTo="/training/simulations",
            ),
            RoutePermission(
                path="/training/cohorts",
                roles=["instructional", "admin", "superadmin"],
                title="Cohorts Management",
                redirectTo="/training/cohorts",
            ),
            RoutePermission(
                path="/training/cohorts/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Cohort",
                redirectTo="/training/cohorts",
            ),
            RoutePermission(
                path="/training/cohorts/c/[cohortId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Cohort",
                redirectTo="/training/cohorts",
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
                redirectTo="/management/staff",
            ),
            RoutePermission(
                path="/management/staff",
                roles=["superadmin"],
                title="Staff Management",
                redirectTo="/management/staff",
            ),
            RoutePermission(
                path="/management/staff/new",
                roles=["superadmin"],
                title="Create Staff",
                redirectTo="/management/staff",
            ),
            RoutePermission(
                path="/management/staff/p/[profileId]",
                roles=["superadmin"],
                title="Staff Profile",
                redirectTo="/management/staff",
            ),
            RoutePermission(
                path="/management/documents",
                roles=["admin", "superadmin"],
                title="Documents",
                redirectTo="/management/documents",
            ),
            RoutePermission(
                path="/management/documents/new",
                roles=["admin", "superadmin"],
                title="Create Document",
                redirectTo="/management/documents",
            ),
            RoutePermission(
                path="/management/documents/d/[documentId]",
                roles=["admin", "superadmin"],
                title="View Document",
                redirectTo="/management/documents",
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
            RoutePermission(
                path="/management/fields",
                roles=["admin", "superadmin"],
                title="Fields",
                redirectTo="/management/fields",
            ),
            RoutePermission(
                path="/management/fields/new",
                roles=["admin", "superadmin"],
                title="Create Field",
                redirectTo="/management/fields",
            ),
            RoutePermission(
                path="/management/fields/[fieldId]",
                roles=["admin", "superadmin"],
                title="Edit Field",
                redirectTo="/management/fields",
            ),
        ],
    ),
    SectionPermission(
        section="intelligence",
        roles=["superadmin", "custom"],
        title="Intelligence",
        description="Intelligence configuration tools",
        routes=[
            RoutePermission(
                path="/intelligence",
                roles=["superadmin", "custom"],
                title="Intelligence Overview",
                redirectTo="/intelligence/agents",
            ),
            RoutePermission(
                path="/intelligence/agents",
                roles=["superadmin", "custom"],
                title="Agents",
                redirectTo="/intelligence/agents",
            ),
            RoutePermission(
                path="/intelligence/agents/new",
                roles=["superadmin"],
                title="Create Agent",
                redirectTo="/intelligence/agents",
            ),
            RoutePermission(
                path="/intelligence/agents/a/[agentId]",
                roles=["superadmin"],
                title="Edit Agent",
                redirectTo="/intelligence/agents",
            ),
            RoutePermission(
                path="/intelligence/models",
                roles=["superadmin"],
                title="Models",
                redirectTo="/intelligence/models",
            ),
            RoutePermission(
                path="/intelligence/models/new",
                roles=["superadmin"],
                title="Create Model",
                redirectTo="/intelligence/models",
            ),
            RoutePermission(
                path="/intelligence/models/[modelId]",
                roles=["superadmin"],
                title="Edit Model",
                redirectTo="/intelligence/models",
            ),
            RoutePermission(
                path="/intelligence/providers",
                roles=["superadmin"],
                title="Providers",
                redirectTo="/intelligence/providers",
            ),
            RoutePermission(
                path="/intelligence/providers/new",
                roles=["superadmin"],
                title="Create Provider",
                redirectTo="/intelligence/providers",
            ),
            RoutePermission(
                path="/intelligence/providers/p/[providerId]",
                roles=["superadmin"],
                title="Edit Provider",
                redirectTo="/intelligence/providers",
            ),
            RoutePermission(
                path="/intelligence/tools",
                roles=["superadmin"],
                title="Tools",
                redirectTo="/intelligence/tools",
            ),
            RoutePermission(
                path="/intelligence/tools/new",
                roles=["superadmin"],
                title="Create Tool",
                redirectTo="/intelligence/tools",
            ),
            RoutePermission(
                path="/intelligence/tools/t/[toolId]",
                roles=["superadmin"],
                title="Edit Tool",
                redirectTo="/intelligence/tools",
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
                redirectTo="/system/departments",
            ),
            RoutePermission(
                path="/system/auth",
                roles=["superadmin"],
                title="Auth",
                redirectTo="/system/auth",
            ),
            RoutePermission(
                path="/system/auth/new",
                roles=["superadmin"],
                title="Create Auth",
                redirectTo="/system/auth",
            ),
            RoutePermission(
                path="/system/auth/a/[authId]",
                roles=["superadmin"],
                title="Edit Auth",
                redirectTo="/system/auth",
            ),
            RoutePermission(
                path="/system/evals",
                roles=["superadmin"],
                title="Evals",
                redirectTo="/system/evals",
            ),
            RoutePermission(
                path="/system/evals/new",
                roles=["superadmin"],
                title="Create Eval",
                redirectTo="/system/evals",
            ),
            RoutePermission(
                path="/system/evals/e/[evalId]",
                roles=["superadmin"],
                title="Edit Eval",
                redirectTo="/system/evals",
            ),
            RoutePermission(
                path="/system/departments",
                roles=["instructional", "admin", "superadmin"],
                title="Departments",
                redirectTo="/system/departments",
            ),
            RoutePermission(
                path="/system/departments/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Department",
                redirectTo="/system/departments",
            ),
            RoutePermission(
                path="/system/departments/d/[departmentId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Department",
                redirectTo="/system/departments",
            ),
            RoutePermission(
                path="/system/rubrics",
                roles=["superadmin"],
                title="Rubrics",
                redirectTo="/system/rubrics",
            ),
            RoutePermission(
                path="/system/rubrics/new",
                roles=["superadmin"],
                title="Create Rubric",
                redirectTo="/system/rubrics",
            ),
            RoutePermission(
                path="/system/rubrics/r/[rubricId]",
                roles=["superadmin"],
                title="Edit Rubric",
                redirectTo="/system/rubrics",
            ),
        ],
    ),
    SectionPermission(
        section="health",
        roles=["superadmin"],
        title="Health",
        description="System health monitoring",
        routes=[
            RoutePermission(
                path="/health",
                roles=["superadmin"],
                title="System Health",
                redirectTo="/health",
            ),
        ],
    ),
    SectionPermission(
        section="benchmark",
        roles=["superadmin"],
        title="Benchmark",
        description="Run and manage evaluations",
        routes=[
            RoutePermission(
                path="/benchmark",
                roles=["superadmin"],
                title="Benchmark",
                redirectTo="/benchmark",
            ),
            RoutePermission(
                path="/benchmark/er/[eval_run_id]",
                roles=["superadmin"],
                title="Evaluation Run",
                redirectTo="/benchmark",
            ),
        ],
    ),
    SectionPermission(
        section="settings",
        roles=["admin", "superadmin"],
        title="Settings",
        description="System settings and configuration",
        routes=[
            RoutePermission(
                path="/settings",
                roles=["admin", "superadmin"],
                title="Settings",
                redirectTo="/settings",
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
        "guest": "/practice",  # Guest users start at practice
        "member": "/home",  # Member users start at home
        "instructional": "/analytics/dashboard",  # Instructional staff starts at analytics dashboard
        "admin": "/analytics/dashboard",  # Admins start at analytics dashboard
        "superadmin": "/analytics/dashboard",  # Superadmins start at analytics dashboard
    }
    return redirect_map.get(role, "/home")  # Default fallback to home
