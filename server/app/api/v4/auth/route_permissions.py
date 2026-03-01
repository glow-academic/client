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
    artifact: str | None = Field(
        default=None, description="Artifact that grants access to this route"
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


class TypeItem(BaseModel):
    """Generic typed operation reference for artifact/resource/entry types."""

    name: str
    operation: str


class PageMetadata(BaseModel):
    is_list_page: bool = False
    is_detail_page: bool = False
    is_create_page: bool = False
    is_analytics_page: bool = False
    show_analytics_filters: bool = False
    show_save_toolbar: bool = False
    show_drafts: bool = False
    artifact_type: str | None = None
    create_url: str | None = None
    create_label: str | None = None
    valid_artifact_types: list[TypeItem] = Field(default_factory=list)
    valid_resource_types: list[TypeItem] = Field(default_factory=list)
    valid_entry_types: list[TypeItem] = Field(default_factory=list)


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
                artifact="home",
            ),
            RoutePermission(
                path="/home/[attemptId]",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Simulation Attempt",
                redirectTo="/home",
                artifact="attempt",
            ),
            RoutePermission(
                path="/home/[attemptId]/[trainingId]",
                roles=["member", "instructional", "admin", "superadmin"],
                title="Customize Training",
                redirectTo="/home",
                artifact="chat",
            ),
            # Canonical routes (top-level)
            RoutePermission(
                path="/attempt/[attemptId]",
                roles=["guest", "member", "instructional", "admin", "superadmin"],
                title="Attempt",
                redirectTo="/home",
                artifact="attempt",
            ),
            RoutePermission(
                path="/chat/[chatId]",
                roles=["guest", "member", "instructional", "admin", "superadmin"],
                title="Customize Training",
                redirectTo="/home",
                artifact="chat",
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
                artifact="practice",
            ),
            RoutePermission(
                path="/practice/[attemptId]",
                roles=["guest", "member", "instructional", "admin", "superadmin"],
                title="Practice Attempt",
                redirectTo="/practice",
                artifact="attempt",
            ),
            RoutePermission(
                path="/practice/[attemptId]/[trainingId]",
                roles=["guest", "member", "instructional", "admin", "superadmin"],
                title="Customize Practice",
                redirectTo="/practice",
                artifact="chat",
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
                artifact="leaderboard",
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
            # Section parent — accessible if any child artifact is available
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
                artifact="dashboard",
            ),
            RoutePermission(
                path="/analytics/reports",
                roles=["instructional", "admin", "superadmin"],
                title="Reports",
                redirectTo="/analytics/reports",
                artifact="reports",
            ),
            RoutePermission(
                path="/analytics/reports/[profileId]",
                roles=["instructional", "admin", "superadmin"],
                title="Profile Report",
                redirectTo="/analytics/reports",
                artifact_type="profile",
                artifact="record",
            ),
            RoutePermission(
                path="/analytics/activity",
                roles=["instructional", "admin", "superadmin"],
                title="Activity",
                redirectTo="/analytics/activity",
                artifact="activity",
            ),
            RoutePermission(
                path="/analytics/activity/[sessionId]",
                roles=["instructional", "admin", "superadmin"],
                title="Session Activity",
                redirectTo="/analytics/activity",
                artifact="session",
            ),
            RoutePermission(
                path="/analytics/pricing",
                roles=["instructional", "admin", "superadmin"],
                title="Pricing",
                redirectTo="/analytics/pricing",
                artifact="pricing",
            ),
            RoutePermission(
                path="/analytics/pricing/[groupId]",
                roles=["instructional", "admin", "superadmin"],
                title="Pricing Group",
                redirectTo="/analytics/pricing",
                artifact="group",
            ),
            # Canonical routes (top-level)
            RoutePermission(
                path="/record/[recordId]",
                roles=["instructional", "admin", "superadmin"],
                title="Profile Report",
                redirectTo="/analytics/reports",
                artifact_type="profile",
                artifact="record",
            ),
            RoutePermission(
                path="/session/[sessionId]",
                roles=["instructional", "admin", "superadmin"],
                title="Session Activity",
                redirectTo="/analytics/activity",
                artifact="session",
            ),
            RoutePermission(
                path="/group/[groupId]",
                roles=["instructional", "admin", "superadmin"],
                title="Pricing Group",
                redirectTo="/analytics/pricing",
                artifact="group",
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
            # Section parent — accessible if any child artifact is available
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
                artifact="cohort",
            ),
            RoutePermission(
                path="/training/cohorts/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Cohort",
                redirectTo="/training/cohorts",
                artifact_type="cohort",
                artifact="cohort",
            ),
            RoutePermission(
                path="/training/cohorts/[cohortId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Cohort",
                redirectTo="/training/cohorts",
                artifact_type="cohort",
                artifact="cohort",
            ),
            RoutePermission(
                path="/training/simulations",
                roles=["instructional", "admin", "superadmin"],
                title="Simulations",
                redirectTo="/training/simulations",
                create_label="Create Simulation",
                artifact="simulation",
            ),
            RoutePermission(
                path="/training/simulations/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Simulation",
                redirectTo="/training/simulations",
                artifact_type="simulation",
                artifact="simulation",
            ),
            RoutePermission(
                path="/training/simulations/[simulationId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Simulation",
                redirectTo="/training/simulations",
                artifact_type="simulation",
                artifact="simulation",
            ),
            RoutePermission(
                path="/training/scenarios",
                roles=["instructional", "admin", "superadmin"],
                title="Scenarios",
                redirectTo="/training/scenarios",
                create_label="Create Scenario",
                artifact="scenario",
            ),
            RoutePermission(
                path="/training/scenarios/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Scenario",
                redirectTo="/training/scenarios",
                artifact_type="scenario",
                artifact="scenario",
            ),
            RoutePermission(
                path="/training/scenarios/[scenarioId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Scenario",
                redirectTo="/training/scenarios",
                artifact_type="scenario",
                artifact="scenario",
            ),
            RoutePermission(
                path="/training/personas",
                roles=["instructional", "admin", "superadmin"],
                title="Personas",
                redirectTo="/training/personas",
                create_label="Create Persona",
                artifact="persona",
            ),
            RoutePermission(
                path="/training/personas/new",
                roles=["instructional", "admin", "superadmin"],
                title="Create Persona",
                redirectTo="/training/personas",
                artifact_type="persona",
                artifact="persona",
            ),
            RoutePermission(
                path="/training/personas/[personaId]",
                roles=["instructional", "admin", "superadmin"],
                title="Edit Persona",
                redirectTo="/training/personas",
                artifact_type="persona",
                artifact="persona",
            ),
        ],
    ),
    # --- TEMPORARILY COMMENTED OUT: management, intelligence, system, health, settings ---
    # SectionPermission(
    #     section="management",
    #     roles=["admin", "superadmin"],
    #     title="Management",
    #     description="System management tools",
    #     icon="ClipboardList",
    #     order=5,
    #     children=["profiles", "documents", "parameters", "fields"],
    #     routes=[...],
    # ),
    # SectionPermission(
    #     section="intelligence",
    #     roles=["admin", "superadmin"],
    #     title="Intelligence",
    #     description="Intelligence configuration tools",
    #     icon="Sparkles",
    #     order=6,
    #     children=["agents", "models", "providers", "tools"],
    #     routes=[...],
    # ),
    # SectionPermission(
    #     section="system",
    #     roles=["superadmin"],
    #     title="System",
    #     description="System administration tools",
    #     icon="Server",
    #     order=7,
    #     children=["departments", "rubrics", "auth", "evals"],
    #     routes=[...],
    # ),
    # SectionPermission(
    #     section="health",
    #     roles=["admin", "superadmin"],
    #     title="Health",
    #     description="System health monitoring",
    #     icon="Activity",
    #     order=8,
    #     routes=[...],
    # ),
    SectionPermission(
        section="benchmark",
        roles=["custom", "instructional", "admin", "superadmin"],
        title="Benchmark",
        description="Run and manage evaluations",
        icon="Gauge",
        order=9,
        routes=[
            RoutePermission(
                path="/benchmark",
                roles=["custom", "instructional", "admin", "superadmin"],
                title="Benchmark",
                redirectTo="/benchmark",
                artifact="benchmark",
            ),
            RoutePermission(
                path="/benchmark/[testId]",
                roles=["custom", "instructional", "admin", "superadmin"],
                title="Benchmark Test",
                redirectTo="/benchmark",
                artifact="test",
            ),
            RoutePermission(
                path="/benchmark/[testId]/[suiteId]",
                roles=["custom", "instructional", "admin", "superadmin"],
                title="Benchmark Suite",
                redirectTo="/benchmark",
                artifact="eval",
            ),
        ],
    ),
    # SectionPermission(
    #     section="settings",
    #     roles=["admin", "superadmin"],
    #     title="Settings",
    #     description="System settings and configuration",
    #     icon="Settings",
    #     order=10,
    #     routes=[...],
    # ),
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


def compute_available_routes(user_artifacts: list[str]) -> list[str]:
    """Expand artifact list into route paths."""
    artifact_set = set(user_artifacts)
    routes: list[str] = []
    for sp in ROUTE_PERMISSIONS:
        for rp in sp.routes:
            if rp.artifact and rp.artifact in artifact_set:
                routes.append(rp.path)
    return routes


def compute_available_sections(user_artifacts: list[str]) -> list[str]:
    """Derive sections from artifacts — a section is visible if ANY of its routes' artifacts are in user_artifacts."""
    artifact_set = set(user_artifacts)
    sections: list[str] = []
    for sp in ROUTE_PERMISSIONS:
        if any(rp.artifact in artifact_set for rp in sp.routes if rp.artifact):
            sections.append(sp.section)
    return sections


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

        # For section-level breadcrumbs, try to resolve section from route patterns
        if not section and i == 0:
            for pattern, sec in _ROUTE_TO_SECTION.items():
                if _match_route_pattern(pattern, pathname):
                    section = sec
                    break
            if not section:
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
    available_sections: list[str] | None = None,
) -> PageAccess:
    """Check if the current pathname is accessible given available_routes."""
    if not pathname or pathname == "/":
        return PageAccess(authorized=True)

    # Try matching against each available route pattern
    for route_pattern in available_routes:
        if _match_route_pattern(route_pattern, pathname):
            return PageAccess(authorized=True)

    # For section parent routes (e.g. /training, /analytics, /management),
    # allow access if the section itself is available
    segments = [s for s in pathname.split("/") if s]
    if segments and available_sections:
        section = segments[0]
        if len(segments) == 1 and section in (available_sections or []):
            return PageAccess(authorized=True)

    # Find the section to compute redirect
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


_CORE_ARTIFACT_SECTIONS = {
    "training",
    "management",
    "intelligence",
    "system",
    "settings",
}
_BUNDLE_SECTIONS = {"home", "practice", "benchmark"}


_LIST_OPS = frozenset(
    {"get", "list", "save", "duplicate", "delete", "draft", "docs", "export", "refresh"}
)
_DETAIL_OPS = frozenset({"get", "draft", "docs", "refresh"})
_RESOURCE_MUTATION_OPS = frozenset({"create", "link", "docs"})
_ENTRY_OPS = frozenset({"get", "search", "create", "refresh", "docs"})


def _resolve_valid_types(
    artifact_type: str | None,
    *,
    is_list: bool = False,
    is_detail: bool = False,
) -> tuple[list[TypeItem], list[TypeItem], list[TypeItem]]:
    """Look up the generation registry for the given artifact_type and return
    (valid_artifact_types, valid_resource_types, valid_entry_types).

    Artifact operations are context-aware:
    - List pages: get, list, save, duplicate, delete, draft, docs, export
    - Detail pages: get, draft, docs
    - Fallback: all endpoints declared in ArtifactMeta

    Resource operations emit create/link/docs for each implemented resource.
    Entry operations keep the simple get-per-type pattern.
    """
    if not artifact_type:
        return [], [], []

    try:
        from app.socket.v5.client.registry import REGISTRY
    except ImportError:
        return [], [], []

    config = REGISTRY.get(artifact_type)
    if not config:
        return [], [], []

    # --- Artifact operations (context-aware) ---
    from app.registry.artifacts import ARTIFACTS
    from app.registry.operations import ARTIFACT_OPS

    if is_list:
        allowed_ops = _LIST_OPS
    elif is_detail:
        allowed_ops = _DETAIL_OPS
    else:
        meta = ARTIFACTS.get(artifact_type)
        allowed_ops = meta.endpoints if meta else frozenset({"get"})

    valid_artifact_types: list[TypeItem] = []
    for op in sorted(allowed_ops):
        if ARTIFACT_OPS.get((artifact_type, op)) is not None:
            valid_artifact_types.append(TypeItem(name=artifact_type, operation=op))

    # --- Resource operations (create/link/docs where implemented) ---
    from app.registry.operations import RESOURCE_OPS

    valid_resource_types: list[TypeItem] = []
    for rt in config.valid_resource_types:
        for op in sorted(_RESOURCE_MUTATION_OPS):
            if RESOURCE_OPS.get((rt, op)) is not None:
                valid_resource_types.append(TypeItem(name=rt, operation=op))

    # --- Entry operations (all implemented ops per entry type) ---
    from app.registry.operations import ENTRY_OPS

    valid_entry_types: list[TypeItem] = []
    for et in config.entry_types:
        for op in sorted(_ENTRY_OPS):
            if ENTRY_OPS.get((et, op)) is not None:
                valid_entry_types.append(TypeItem(name=et, operation=op))
    return valid_artifact_types, valid_resource_types, valid_entry_types


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

    # Count UUID segments for bundle/attempt detection
    uuid_segments = [s for s in segments if _is_uuid(s)]

    # Bundle pages: /home|practice|benchmark/[id]/[id]
    is_bundle = section in _BUNDLE_SECTIONS and len(uuid_segments) >= 2
    # Attempt pages: /home|practice|benchmark/[id] (exactly 1 UUID)
    is_attempt = section in _BUNDLE_SECTIONS and len(uuid_segments) == 1

    # Determine page type
    is_create = len(segments) >= 2 and segments[-1] == "new"
    has_uuid = len(uuid_segments) > 0

    # Only show analytics filters on list pages, not detail/attempt/bundle pages
    show_analytics_filters = is_analytics and not has_uuid
    is_detail = has_uuid and not is_create and not is_bundle and not is_attempt

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
                artifact_type = rp.artifact_type or rp.artifact
                if is_list and rp.create_label and section in _CORE_ARTIFACT_SECTIONS:
                    create_label = rp.create_label
                    # Check if the /new route is available in user's routes
                    new_path = pathname.rstrip("/") + "/new"
                    for avail in available_routes:
                        if _match_route_pattern(avail, new_path):
                            create_url = new_path
                            break
                break
        if artifact_type is not None or create_label is not None:
            break

    # Derive artifact_type from pathname if not found in route config
    if not artifact_type and (is_list or is_detail or is_create):
        # e.g., /training/personas → "persona"
        # e.g., /training/personas/[id] → "persona"
        # e.g., /management/profiles/[id] → "profile"
        subsection_map = {
            "profiles": "profile",
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

    # Bundle pages get artifact_type based on section
    if is_bundle and not artifact_type:
        if section in {"home", "practice"}:
            artifact_type = "chat"
        elif section == "benchmark":
            artifact_type = "eval"

    # show_drafts: create/edit pages for core artifacts, or bundle pages
    is_core_artifact_page = section in _CORE_ARTIFACT_SECTIONS and (
        is_create or is_detail
    )
    show_drafts = is_core_artifact_page or is_bundle
    show_save_toolbar = show_drafts

    # Resolve valid generation types from the server registry
    valid_artifact_types, valid_resource_types, valid_entry_types = (
        _resolve_valid_types(artifact_type, is_list=is_list, is_detail=is_detail)
    )

    return PageMetadata(
        is_list_page=is_list,
        is_detail_page=is_detail,
        is_create_page=is_create,
        is_analytics_page=is_analytics,
        show_analytics_filters=show_analytics_filters,
        show_save_toolbar=show_save_toolbar,
        show_drafts=show_drafts,
        artifact_type=artifact_type,
        create_url=create_url,
        create_label=create_label,
        valid_artifact_types=valid_artifact_types,
        valid_resource_types=valid_resource_types,
        valid_entry_types=valid_entry_types,
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


def compute_redirect_path(role: str | None, first_available_route: str | None) -> str:
    """Compute the landing page redirect path for a profile.

    Business layer override: member/instructional/admin/superadmin always land on /home.
    All other roles (guest, custom, etc.) use their first available route.
    """
    if role in ("member", "instructional", "admin", "superadmin"):
        return "/home"
    return first_available_route or "/home"


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
    ("management", "profiles"): ("profile", "profile_names_junction"),
    ("management", "fields"): ("field", "field_names_junction"),
    ("system", "rubrics"): ("rubric", "rubric_names_junction"),
    ("system", "departments"): ("department", "department_names_junction"),
    ("system", "evals"): ("eval", "eval_names_junction"),
    ("system", "auth"): ("auth", "auth_names_junction"),
    ("analytics", "reports"): ("profile", "profile_names_junction"),
    ("settings", ""): ("setting", "setting_names_junction"),
}


# Maps (section,) → (table, column) for entities with denormalized names
ENTITY_NAME_DIRECT: dict[str, tuple[str, str]] = {
    "attempt": ("attempt_entry", "name"),
}


def get_entity_name_direct(pathname: str) -> tuple[str, str, str] | None:
    """Given a pathname, return (entity_id, table, column) if the entity has a
    denormalized name column, or None."""
    segments = [s for s in pathname.split("/") if s]
    if len(segments) < 2:
        return None

    section = segments[0]
    mapping = ENTITY_NAME_DIRECT.get(section)
    if not mapping:
        return None

    # Find the UUID segment
    for seg in segments:
        if _is_uuid(seg):
            return (seg, mapping[0], mapping[1])

    return None


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
