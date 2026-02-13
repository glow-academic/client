"""Server-driven route permissions, sidebar, breadcrumbs, and page metadata.

This module is the single source of truth for:
- Route paths and their access roles
- Sidebar structure (icon, order, children)
- Breadcrumb computation from pathname
- Page metadata (list/detail/create flags, action buttons)
- Page access checks against available_routes
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field

# Profile role type (matches database enum)
ProfileRole = Literal[
    "guest", "member", "instructional", "admin", "superadmin", "custom"
]

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


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
    create_label: str | None = Field(
        default=None, description="Label for create button on list pages"
    )
    artifact_type: str | None = Field(
        default=None, description="Artifact type for edit/create pages"
    )

    model_config = {"populate_by_name": True}


class SectionPermission(BaseModel):
    """Section permission configuration with nested routes."""

    section: str = Field(..., description="Section identifier")
    roles: list[ProfileRole] = Field(
        ..., description="Roles allowed to access this section"
    )
    title: str = Field(..., description="Human-readable section title")
    description: str | None = Field(default=None, description="Section description")
    routes: list[RoutePermission] = Field(..., description="Routes within this section")
    icon: str | None = Field(default=None, description="Lucide icon name")
    order: int = Field(default=0, description="Sidebar display order")
    children: list[str] | None = Field(
        default=None, description="Sidebar sub-section identifiers"
    )

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Response models for API
# ---------------------------------------------------------------------------


class SidebarMenuItem(BaseModel):
    title: str
    section: str
    url: str


class SidebarSection(BaseModel):
    title: str
    section: str
    icon: str
    url: str
    items: list[SidebarMenuItem] | None = None


class BreadcrumbItem(BaseModel):
    title: str
    section: str | None = None
    url: str


class PageAccess(BaseModel):
    authorized: bool = True
    redirect: str | None = None
    reason: str | None = None


class PageMetadata(BaseModel):
    is_list_page: bool = False
    is_detail_page: bool = False
    is_create_page: bool = False
    is_analytics_page: bool = False
    show_analytics_filters: bool = False
    show_save_toolbar: bool = False
    artifact_type: str | None = None
    create_url: str | None = None
    create_label: str | None = None


# Rebuild Pydantic models to resolve forward references
SidebarSection.model_rebuild()


# ---------------------------------------------------------------------------
# ROUTE_PERMISSIONS — all paths use actual filesystem routes (no single-letter
# prefixes).
# ---------------------------------------------------------------------------

ROUTE_PERMISSIONS: list[SectionPermission] = [
    SectionPermission(
        section="home",
        roles=["member", "instructional", "admin", "superadmin"],
        title="Home",
        description="Main dashboard for member users",
        icon="Home",
        order=0,
        routes=[
            RoutePermission(
                path="/home",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Home",
                redirectTo="/home",
            ),
            RoutePermission(
                path="/home/[attemptId]",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Simulation Attempt",
                redirectTo="/home",
            ),
            RoutePermission(
                path="/home/[attemptId]/[bundleId]",
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
        icon="Target",
        order=1,
        routes=[
            RoutePermission(
                path="/practice",
                roles=["guest", "member", "instructional", "admin", "superadmin"],
                title="Practice",
                redirectTo="/practice",
            ),
            RoutePermission(
                path="/practice/[attemptId]",
                roles=["guest", "member", "instructional", "admin", "superadmin"],
                title="Practice Attempt",
                redirectTo="/practice",
            ),
            RoutePermission(
                path="/practice/[attemptId]/[bundleId]",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Customize Practice",
                redirectTo="/practice",
            ),
        ],
    ),
    SectionPermission(
        section="leaderboard",
        roles=["member", "instructional", "admin", "superadmin"],
        title="Leaderboard",
        description="Performance leaderboard and rankings",
        icon="Trophy",
        order=2,
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
        section="analytics",
        roles=["instructional", "admin", "superadmin"],
        title="Analytics",
        description="Analytics and reporting tools",
        icon="PieChart",
        order=3,
        children=["dashboard", "reports", "activity", "pricing"],
        routes=[
            RoutePermission(
                path="/analytics",
                roles=["instructional", "admin", "superadmin"],
                title="Analytics",
                redirectTo="/analytics/dashboard",
            ),
            RoutePermission(
                path="/analytics/dashboard",
                roles=["instructional", "admin", "superadmin"],
                title="Dashboard",
                redirectTo="/analytics/dashboard",
            ),
            RoutePermission(
                path="/analytics/reports",
                roles=["instructional", "admin", "superadmin"],
                title="Reports",
                redirectTo="/analytics/reports",
            ),
            RoutePermission(
                path="/analytics/reports/[profileId]",
                roles=["instructional", "admin", "superadmin"],
                title="Profile Report",
                redirectTo="/analytics/reports",
                artifact_type="profile",
            ),
            RoutePermission(
                path="/analytics/activity",
                roles=["instructional", "admin", "superadmin"],
                title="Activity",
                redirectTo="/analytics/activity",
            ),
            RoutePermission(
                path="/analytics/activity/[sessionId]",
                roles=["instructional", "admin", "superadmin"],
                title="Session Activity",
                redirectTo="/analytics/activity",
            ),
            RoutePermission(
                path="/analytics/pricing",
                roles=["instructional", "admin", "superadmin"],
                title="Pricing",
                redirectTo="/analytics/pricing",
            ),
            RoutePermission(
                path="/analytics/pricing/[groupId]",
                roles=["instructional", "admin", "superadmin"],
                title="Pricing Group",
                redirectTo="/analytics/pricing",
            ),
        ],
    ),
    SectionPermission(
        section="training",
        roles=["instructional", "admin", "superadmin"],
        title="Training",
        description="Training content tools",
        icon="GraduationCap",
        order=4,
        children=["cohorts", "simulations", "scenarios", "personas"],
        routes=[
            RoutePermission(
                path="/training",
                roles=["instructional", "admin", "superadmin"],
                title="Training",
                redirectTo="/training/personas",
            ),
            RoutePermission(
                path="/training/cohorts",
                roles=["instructional", "admin", "superadmin"],
                title="Cohorts",
                redirectTo="/training/cohorts",
                create_label="Create Cohort",
            ),
            RoutePermission(
                path="/training/cohorts/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Cohort",
                redirectTo="/training/cohorts",
                artifact_type="cohort",
            ),
            RoutePermission(
                path="/training/cohorts/[cohortId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Cohort",
                redirectTo="/training/cohorts",
                artifact_type="cohort",
            ),
            RoutePermission(
                path="/training/simulations",
                roles=["instructional", "admin", "superadmin"],
                title="Simulations",
                redirectTo="/training/simulations",
                create_label="Create Simulation",
            ),
            RoutePermission(
                path="/training/simulations/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Simulation",
                redirectTo="/training/simulations",
                artifact_type="simulation",
            ),
            RoutePermission(
                path="/training/simulations/[simulationId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Simulation",
                redirectTo="/training/simulations",
                artifact_type="simulation",
            ),
            RoutePermission(
                path="/training/scenarios",
                roles=["instructional", "admin", "superadmin"],
                title="Scenarios",
                redirectTo="/training/scenarios",
                create_label="Create Scenario",
            ),
            RoutePermission(
                path="/training/scenarios/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Scenario",
                redirectTo="/training/scenarios",
                artifact_type="scenario",
            ),
            RoutePermission(
                path="/training/scenarios/[scenarioId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Scenario",
                redirectTo="/training/scenarios",
                artifact_type="scenario",
            ),
            RoutePermission(
                path="/training/personas",
                roles=["instructional", "admin", "superadmin"],
                title="Personas",
                redirectTo="/training/personas",
                create_label="Create Persona",
            ),
            RoutePermission(
                path="/training/personas/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Persona",
                redirectTo="/training/personas",
                artifact_type="persona",
            ),
            RoutePermission(
                path="/training/personas/[personaId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Persona",
                redirectTo="/training/personas",
                artifact_type="persona",
            ),
        ],
    ),
    SectionPermission(
        section="management",
        roles=["admin", "superadmin"],
        title="Management",
        description="System management tools",
        icon="ClipboardList",
        order=5,
        children=["staff", "documents", "parameters", "fields"],
        routes=[
            RoutePermission(
                path="/management",
                roles=["admin", "superadmin"],
                title="Management",
                redirectTo="/management/staff",
            ),
            RoutePermission(
                path="/management/staff",
                roles=["superadmin"],
                title="Staff",
                redirectTo="/management/staff",
                create_label="Create Staff",
            ),
            RoutePermission(
                path="/management/staff/new",
                roles=["superadmin"],
                title="Create Staff",
                redirectTo="/management/staff",
                artifact_type="profile",
            ),
            RoutePermission(
                path="/management/staff/[profileId]",
                roles=["superadmin"],
                title="Staff Profile",
                redirectTo="/management/staff",
                artifact_type="profile",
            ),
            RoutePermission(
                path="/management/documents",
                roles=["admin", "superadmin"],
                title="Documents",
                redirectTo="/management/documents",
                create_label="Create Document",
            ),
            RoutePermission(
                path="/management/documents/new",
                roles=["admin", "superadmin"],
                title="Create Document",
                redirectTo="/management/documents",
                artifact_type="document",
            ),
            RoutePermission(
                path="/management/documents/[documentId]",
                roles=["admin", "superadmin"],
                title="View Document",
                redirectTo="/management/documents",
                artifact_type="document",
            ),
            RoutePermission(
                path="/management/parameters",
                roles=["admin", "superadmin"],
                title="Parameters",
                redirectTo="/management/parameters",
                create_label="Create Parameter",
            ),
            RoutePermission(
                path="/management/parameters/new",
                roles=["admin", "superadmin"],
                title="Create Parameter",
                redirectTo="/management/parameters",
                artifact_type="parameter",
            ),
            RoutePermission(
                path="/management/parameters/[parameterId]",
                roles=["admin", "superadmin"],
                title="Edit Parameter",
                redirectTo="/management/parameters",
                artifact_type="parameter",
            ),
            RoutePermission(
                path="/management/fields",
                roles=["admin", "superadmin"],
                title="Fields",
                redirectTo="/management/fields",
                create_label="Create Field",
            ),
            RoutePermission(
                path="/management/fields/new",
                roles=["admin", "superadmin"],
                title="Create Field",
                redirectTo="/management/fields",
                artifact_type="field",
            ),
            RoutePermission(
                path="/management/fields/[fieldId]",
                roles=["admin", "superadmin"],
                title="Edit Field",
                redirectTo="/management/fields",
                artifact_type="field",
            ),
        ],
    ),
    SectionPermission(
        section="intelligence",
        roles=["superadmin", "custom"],
        title="Intelligence",
        description="Intelligence configuration tools",
        icon="Sparkles",
        order=6,
        children=["agents", "models", "providers", "tools"],
        routes=[
            RoutePermission(
                path="/intelligence",
                roles=["superadmin", "custom"],
                title="Intelligence",
                redirectTo="/intelligence/agents",
            ),
            RoutePermission(
                path="/intelligence/agents",
                roles=["superadmin", "custom"],
                title="Agents",
                redirectTo="/intelligence/agents",
                create_label="Create Agent",
            ),
            RoutePermission(
                path="/intelligence/agents/new",
                roles=["superadmin"],
                title="Create Agent",
                redirectTo="/intelligence/agents",
                artifact_type="agent",
            ),
            RoutePermission(
                path="/intelligence/agents/[agentId]",
                roles=["superadmin"],
                title="Edit Agent",
                redirectTo="/intelligence/agents",
                artifact_type="agent",
            ),
            RoutePermission(
                path="/intelligence/models",
                roles=["superadmin"],
                title="Models",
                redirectTo="/intelligence/models",
                create_label="Create Model",
            ),
            RoutePermission(
                path="/intelligence/models/new",
                roles=["superadmin"],
                title="Create Model",
                redirectTo="/intelligence/models",
                artifact_type="model",
            ),
            RoutePermission(
                path="/intelligence/models/[modelId]",
                roles=["superadmin"],
                title="Edit Model",
                redirectTo="/intelligence/models",
                artifact_type="model",
            ),
            RoutePermission(
                path="/intelligence/providers",
                roles=["superadmin"],
                title="Providers",
                redirectTo="/intelligence/providers",
                create_label="Create Provider",
            ),
            RoutePermission(
                path="/intelligence/providers/new",
                roles=["superadmin"],
                title="Create Provider",
                redirectTo="/intelligence/providers",
                artifact_type="provider",
            ),
            RoutePermission(
                path="/intelligence/providers/[providerId]",
                roles=["superadmin"],
                title="Edit Provider",
                redirectTo="/intelligence/providers",
                artifact_type="provider",
            ),
            RoutePermission(
                path="/intelligence/tools",
                roles=["superadmin"],
                title="Tools",
                redirectTo="/intelligence/tools",
                create_label="Create Tool",
            ),
            RoutePermission(
                path="/intelligence/tools/new",
                roles=["superadmin"],
                title="Create Tool",
                redirectTo="/intelligence/tools",
                artifact_type="tool",
            ),
            RoutePermission(
                path="/intelligence/tools/[toolId]",
                roles=["superadmin"],
                title="Edit Tool",
                redirectTo="/intelligence/tools",
                artifact_type="tool",
            ),
        ],
    ),
    SectionPermission(
        section="system",
        roles=["superadmin"],
        title="System",
        description="System administration tools",
        icon="Server",
        order=7,
        children=["departments", "rubrics", "auth", "evals"],
        routes=[
            RoutePermission(
                path="/system",
                roles=["superadmin"],
                title="System",
                redirectTo="/system/departments",
            ),
            RoutePermission(
                path="/system/departments",
                roles=["instructional", "admin", "superadmin"],
                title="Departments",
                redirectTo="/system/departments",
                create_label="Create Department",
            ),
            RoutePermission(
                path="/system/departments/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Department",
                redirectTo="/system/departments",
                artifact_type="department",
            ),
            RoutePermission(
                path="/system/departments/[departmentId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Department",
                redirectTo="/system/departments",
                artifact_type="department",
            ),
            RoutePermission(
                path="/system/rubrics",
                roles=["superadmin"],
                title="Rubrics",
                redirectTo="/system/rubrics",
                create_label="Create Rubric",
            ),
            RoutePermission(
                path="/system/rubrics/new",
                roles=["superadmin"],
                title="Create Rubric",
                redirectTo="/system/rubrics",
                artifact_type="rubric",
            ),
            RoutePermission(
                path="/system/rubrics/[rubricId]",
                roles=["superadmin"],
                title="Edit Rubric",
                redirectTo="/system/rubrics",
                artifact_type="rubric",
            ),
            RoutePermission(
                path="/system/auth",
                roles=["superadmin"],
                title="Auth",
                redirectTo="/system/auth",
                create_label="Create Auth",
            ),
            RoutePermission(
                path="/system/auth/new",
                roles=["superadmin"],
                title="Create Auth",
                redirectTo="/system/auth",
                artifact_type="auth",
            ),
            RoutePermission(
                path="/system/auth/[authId]",
                roles=["superadmin"],
                title="Edit Auth",
                redirectTo="/system/auth",
                artifact_type="auth",
            ),
            RoutePermission(
                path="/system/evals",
                roles=["superadmin"],
                title="Evals",
                redirectTo="/system/evals",
                create_label="Create Eval",
            ),
            RoutePermission(
                path="/system/evals/new",
                roles=["superadmin"],
                title="Create Eval",
                redirectTo="/system/evals",
                artifact_type="eval",
            ),
            RoutePermission(
                path="/system/evals/[evalId]",
                roles=["superadmin"],
                title="Edit Eval",
                redirectTo="/system/evals",
                artifact_type="eval",
            ),
        ],
    ),
    SectionPermission(
        section="health",
        roles=["superadmin"],
        title="Health",
        description="System health monitoring",
        icon="Activity",
        order=8,
        routes=[
            RoutePermission(
                path="/health",
                roles=["superadmin"],
                title="Health",
                redirectTo="/health",
            ),
        ],
    ),
    SectionPermission(
        section="benchmark",
        roles=["superadmin"],
        title="Benchmark",
        description="Run and manage evaluations",
        icon="Gauge",
        order=9,
        routes=[
            RoutePermission(
                path="/benchmark",
                roles=["superadmin"],
                title="Benchmark",
                redirectTo="/benchmark",
            ),
            RoutePermission(
                path="/benchmark/[testId]",
                roles=["superadmin"],
                title="Test Run",
                redirectTo="/benchmark",
            ),
            RoutePermission(
                path="/benchmark/[testId]/[bundleId]",
                roles=["superadmin"],
                title="Test Bundle",
                redirectTo="/benchmark",
            ),
        ],
    ),
    SectionPermission(
        section="settings",
        roles=["admin", "superadmin"],
        title="Settings",
        description="System settings and configuration",
        icon="Settings",
        order=10,
        routes=[
            RoutePermission(
                path="/settings",
                roles=["admin", "superadmin"],
                title="Settings",
                redirectTo="/settings",
                create_label="Create Setting",
            ),
            RoutePermission(
                path="/settings/new",
                roles=["admin", "superadmin"],
                title="Create Setting",
                redirectTo="/settings",
                artifact_type="setting",
            ),
            RoutePermission(
                path="/settings/[settingId]",
                roles=["admin", "superadmin"],
                title="Edit Setting",
                redirectTo="/settings",
                artifact_type="setting",
            ),
        ],
    ),
]


# ---------------------------------------------------------------------------
# Lookup helpers (built once at import time)
# ---------------------------------------------------------------------------

# Map section name → SectionPermission for fast lookup
_SECTION_MAP: dict[str, SectionPermission] = {
    sp.section: sp for sp in ROUTE_PERMISSIONS
}

# Map route path → RoutePermission for fast lookup
_ROUTE_MAP: dict[str, RoutePermission] = {}
for _sp in ROUTE_PERMISSIONS:
    for _rp in _sp.routes:
        _ROUTE_MAP[_rp.path] = _rp

# Map route path → section name
_ROUTE_TO_SECTION: dict[str, str] = {}
for _sp in ROUTE_PERMISSIONS:
    for _rp in _sp.routes:
        _ROUTE_TO_SECTION[_rp.path] = _sp.section

# UUID regex for detecting dynamic segments
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


def _is_uuid(segment: str) -> bool:
    return bool(_UUID_RE.match(segment))


# ---------------------------------------------------------------------------
# Computation functions
# ---------------------------------------------------------------------------


def compute_sidebar_routes(
    available_sections: list[str],
) -> list[SidebarSection]:
    """Build sidebar menu from available sections."""
    result: list[SidebarSection] = []

    for sp in sorted(ROUTE_PERMISSIONS, key=lambda s: s.order):
        if sp.section not in available_sections:
            continue

        # Find the base URL for this section (first route that's a list page)
        base_url = f"/{sp.section}"
        for rp in sp.routes:
            # Use the first non-overview, non-parameterized route
            if rp.path == f"/{sp.section}" or (
                sp.children and rp.path == f"/{sp.section}/{sp.children[0]}"
            ):
                base_url = rp.path
                break

        items: list[SidebarMenuItem] | None = None
        if sp.children:
            items = []
            for child in sp.children:
                child_path = f"/{sp.section}/{child}"
                # Find the matching route for the title
                child_title = child.capitalize()
                for rp in sp.routes:
                    if rp.path == child_path:
                        child_title = rp.title
                        break
                items.append(
                    SidebarMenuItem(
                        title=child_title,
                        section=child,
                        url=child_path,
                    )
                )

        result.append(
            SidebarSection(
                title=sp.title,
                section=sp.section,
                icon=sp.icon or "Circle",
                url=base_url,
                items=items,
            )
        )

    return result


def compute_breadcrumbs(pathname: str) -> list[BreadcrumbItem]:
    """Compute breadcrumbs from a pathname.

    For each segment, looks up the matching title from ROUTE_PERMISSIONS.
    UUID segments get a placeholder title (to be resolved with entity name later).
    """
    segments = [s for s in pathname.split("/") if s]
    if not segments:
        return []

    breadcrumbs: list[BreadcrumbItem] = []
    cumulative = ""

    for i, segment in enumerate(segments):
        cumulative += f"/{segment}"

        if _is_uuid(segment):
            # UUID segment — placeholder title, will be resolved later
            breadcrumbs.append(
                BreadcrumbItem(
                    title=segment[:8] + "...",
                    section=None,
                    url=cumulative,
                )
            )
            continue

        if segment == "new":
            breadcrumbs.append(
                BreadcrumbItem(
                    title="New",
                    section=None,
                    url=cumulative,
                )
            )
            continue

        # Try to find a matching route in ROUTE_PERMISSIONS
        title: str | None = None
        section: str | None = None

        # First try exact path match
        for sp in ROUTE_PERMISSIONS:
            for rp in sp.routes:
                if rp.path == cumulative:
                    title = rp.title
                    section = sp.section
                    break
            if title:
                break

        # If no exact match, use section title for first segment
        if not title and i == 0:
            sp_match = _SECTION_MAP.get(segment)
            if sp_match:
                title = sp_match.title
                section = sp_match.section

        # For subsection segments (e.g., "personas" in "/training/personas")
        if not title and i == 1:
            parent = segments[0]
            sp_match = _SECTION_MAP.get(parent)
            if sp_match:
                # Check children
                if sp_match.children and segment in sp_match.children:
                    # Find the route for the title
                    for rp in sp_match.routes:
                        if rp.path == cumulative:
                            title = rp.title
                            break
                    if not title:
                        title = segment.capitalize()
                    section = sp_match.section

        if not title:
            title = segment.replace("-", " ").title()

        # For section-level breadcrumbs, use the section
        if not section and i == 0:
            section = segment

        breadcrumbs.append(
            BreadcrumbItem(
                title=title,
                section=section,
                url=cumulative,
            )
        )

    return breadcrumbs


def _match_route_pattern(pattern: str, pathname: str) -> bool:
    """Match a route pattern (with [param] placeholders) against a real pathname."""
    pattern_parts = [p for p in pattern.split("/") if p]
    path_parts = [p for p in pathname.split("/") if p]

    if len(pattern_parts) != len(path_parts):
        return False

    for pp, rp in zip(pattern_parts, path_parts, strict=True):
        if pp.startswith("[") and pp.endswith("]"):
            # Dynamic segment — matches anything
            continue
        if pp != rp:
            return False

    return True


def compute_page_access(
    pathname: str,
    available_routes: list[str],
) -> PageAccess:
    """Check if the current pathname is accessible given available_routes."""
    if not pathname or pathname == "/":
        return PageAccess(authorized=True)

    # Try matching against each available route pattern
    for route_pattern in available_routes:
        if _match_route_pattern(route_pattern, pathname):
            return PageAccess(authorized=True)

    # Find the section to compute redirect
    segments = [s for s in pathname.split("/") if s]
    if segments:
        section = segments[0]
        sp = _SECTION_MAP.get(section)
        if sp:
            redirect = sp.routes[0].redirectTo if sp.routes else f"/{section}"
            return PageAccess(
                authorized=False,
                redirect=redirect,
                reason="route-denied",
            )

    return PageAccess(
        authorized=False,
        redirect="/home",
        reason="route-denied",
    )


def compute_page_metadata(
    pathname: str,
    available_routes: list[str],
) -> PageMetadata:
    """Derive page metadata from the pathname."""
    segments = [s for s in pathname.split("/") if s]
    if not segments:
        return PageMetadata()

    section = segments[0]

    # Analytics-like sections that show filters
    analytics_sections = {
        "analytics",
        "home",
        "practice",
        "leaderboard",
        "health",
        "benchmark",
    }
    is_analytics = section in analytics_sections
    show_analytics_filters = section in analytics_sections

    # Determine page type
    is_create = len(segments) >= 2 and segments[-1] == "new"
    has_uuid = any(_is_uuid(s) for s in segments)
    is_detail = has_uuid and not is_create

    # A list page is one that matches a known list route (no UUID, not "new")
    is_list = not is_create and not has_uuid and len(segments) >= 1

    # For list pages, find create_url and create_label
    create_url: str | None = None
    create_label: str | None = None
    artifact_type: str | None = None

    # Find the matching route permission for metadata
    for sp in ROUTE_PERMISSIONS:
        for rp in sp.routes:
            if _match_route_pattern(rp.path, pathname):
                artifact_type = rp.artifact_type
                if is_list and rp.create_label:
                    create_label = rp.create_label
                    # Check if the /new route is available
                    new_path = pathname.rstrip("/") + "/new"
                    for avail in available_routes:
                        if _match_route_pattern(avail, new_path):
                            create_url = new_path
                            break
                    # If no pattern match, check if /new route exists in permissions
                    if not create_url:
                        for rp2 in sp.routes:
                            if rp2.path == pathname.rstrip("/") + "/new":
                                create_url = rp2.path
                                break
                break
        if artifact_type is not None or create_label is not None:
            break

    # Derive artifact_type from pathname if not found in route config
    if not artifact_type and (is_detail or is_create):
        # e.g., /training/personas/[id] → "persona"
        # e.g., /management/staff/[id] → "profile"
        subsection_map = {
            "staff": "profile",
        }
        if len(segments) >= 2:
            subsection = (
                segments[-2]
                if is_create
                else segments[-2]
                if has_uuid
                else segments[-1]
            )
            # Remove trailing 's' for singular form
            singular = subsection_map.get(
                subsection,
                subsection.rstrip("s") if subsection.endswith("s") else subsection,
            )
            artifact_type = singular

    show_save_toolbar = is_create or is_detail

    return PageMetadata(
        is_list_page=is_list,
        is_detail_page=is_detail,
        is_create_page=is_create,
        is_analytics_page=is_analytics,
        show_analytics_filters=show_analytics_filters,
        show_save_toolbar=show_save_toolbar,
        artifact_type=artifact_type,
        create_url=create_url,
        create_label=create_label,
    )


# ---------------------------------------------------------------------------
# Legacy helpers (kept for backward compatibility)
# ---------------------------------------------------------------------------


def get_available_subsections_for_role(role: ProfileRole) -> list[str]:
    """Get all available subsections for a role."""
    subsections: set[str] = set()
    for section in ROUTE_PERMISSIONS:
        if role in section.roles:
            subsections.add(section.section)
            for route in section.routes:
                path_parts = [p for p in route.path.split("/") if p]
                if len(path_parts) >= 2:
                    subsections.add(path_parts[1])
    return sorted(subsections)


def get_redirect_path_for_role(role: ProfileRole) -> str:
    """Get the redirect path for a user when access is denied."""
    redirect_map = {
        "guest": "/practice",
        "member": "/home",
        "instructional": "/analytics/dashboard",
        "admin": "/analytics/dashboard",
        "superadmin": "/analytics/dashboard",
    }
    return redirect_map.get(role, "/home")


# ---------------------------------------------------------------------------
# Entity name resolution mapping
# ---------------------------------------------------------------------------

# Maps (section, subsection) → (entity_type, name_junction_table)
ENTITY_NAME_MAP: dict[tuple[str, str], tuple[str, str]] = {
    ("training", "personas"): ("persona", "persona_names_junction"),
    ("training", "scenarios"): ("scenario", "scenario_names_junction"),
    ("training", "simulations"): ("simulation", "simulation_names_junction"),
    ("training", "cohorts"): ("cohort", "cohort_names_junction"),
    ("intelligence", "agents"): ("agent", "agent_names_junction"),
    ("intelligence", "models"): ("model", "model_names_junction"),
    ("intelligence", "tools"): ("tool", "tool_names_junction"),
    ("intelligence", "providers"): ("provider", "provider_names_junction"),
    ("management", "documents"): ("document", "document_names_junction"),
    ("management", "parameters"): ("parameter", "parameter_names_junction"),
    ("management", "staff"): ("profile", "profile_names_junction"),
    ("management", "fields"): ("field", "field_names_junction"),
    ("system", "rubrics"): ("rubric", "rubric_names_junction"),
    ("system", "departments"): ("department", "department_names_junction"),
    ("system", "evals"): ("eval", "eval_names_junction"),
    ("system", "auth"): ("auth", "auth_names_junction"),
    ("analytics", "reports"): ("profile", "profile_names_junction"),
    ("settings", ""): ("setting", "setting_names_junction"),
}


def get_entity_name_junction(pathname: str) -> tuple[str, str, str] | None:
    """Given a pathname, return (entity_id, entity_type, name_junction_table) if it
    contains a UUID that can be resolved, or None."""
    segments = [s for s in pathname.split("/") if s]
    if len(segments) < 2:
        return None

    # Find the UUID segment
    entity_id: str | None = None
    for seg in segments:
        if _is_uuid(seg):
            entity_id = seg
            break

    if not entity_id:
        return None

    section = segments[0]
    subsection = segments[1] if len(segments) >= 2 and not _is_uuid(segments[1]) else ""

    key = (section, subsection)
    mapping = ENTITY_NAME_MAP.get(key)
    if mapping:
        return (entity_id, mapping[0], mapping[1])

    return None
