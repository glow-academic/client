"""Types for profile context internal + HTTP layers."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.auth.route_permissions import (
    BreadcrumbItem,
    PageAccess,
    PageMetadata,
    SidebarSection,
)
from app.api.v4.resources.agents.get import QGetAgentsV4Item
from app.api.v4.resources.cohorts.types import QGetCohortsV4Item
from app.api.v4.resources.departments.get import QGetDepartmentsV4Item
from app.api.v4.resources.settings.types import QGetSettingsV4Item
from app.api.v4.resources.tools.get import QGetToolsV4Item
from app.sql.types import (
    GetProfileContextAccessSqlRow,
    GetSettingsThemeSqlRow,
    QGetProfileContextV4Draft,
    QGetProfileContextV4RoleResource,
    QGetProfileContextV4ThemeTokens,
)


class GetProfileContextApiResponse(BaseModel):
    """Slim profile context response — only fields the client needs."""

    # Authorization
    is_authorized: bool | None = None
    # Profile basics
    id: UUID | None = None
    name: str | None = None
    role: str | None = None
    active: bool | None = None
    # Routing
    scoped_roles: list[str] | None = None
    available_sections: list[str] | None = None
    available_routes: list[str] | None = None
    redirect_path: str | None = None
    # Settings
    settings_id: str | None = None
    settings_success_threshold: int | None = None
    settings_warning_threshold: int | None = None
    settings_danger_threshold: int | None = None
    settings_tokens: QGetProfileContextV4ThemeTokens | None = None
    settings_agents: list[QGetAgentsV4Item] | None = None
    settings_tools: list[QGetToolsV4Item] | None = None
    # Resources
    role_resources: list[QGetProfileContextV4RoleResource] | None = None
    drafts: list[QGetProfileContextV4Draft] | None = None
    # Session
    session_id: UUID | None = None
    actor_name: str | None = None
    # Artifact generation capability
    artifact_has_generation: dict[str, bool] | None = None
    # Server-driven routing
    sidebar_routes: list[SidebarSection] | None = None
    breadcrumbs: list[BreadcrumbItem] | None = None
    page_access: PageAccess | None = None
    page_metadata: PageMetadata | None = None


@dataclass
class ProfileContextInternalData:
    """Internal profile-context facts graph shared by HTTP and artifacts."""

    access: GetProfileContextAccessSqlRow
    actor_name: str | None
    user_role: str | None
    primary_department_id: UUID | None
    departments: list[QGetDepartmentsV4Item]
    cohorts: list[QGetCohortsV4Item]
    drafts: list[QGetProfileContextV4Draft]
    settings: QGetSettingsV4Item | None
    settings_agents: list[QGetAgentsV4Item]
    settings_tools: list[QGetToolsV4Item]
    role_resources: list[QGetProfileContextV4RoleResource]
    settings_theme: GetSettingsThemeSqlRow
    settings_tokens: QGetProfileContextV4ThemeTokens
    session_id: UUID | None
    artifact_has_generation: dict[str, bool]
    pass1_time_ms: float
    pass2_time_ms: float
