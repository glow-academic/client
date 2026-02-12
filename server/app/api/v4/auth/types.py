"""Types for profile context internal + HTTP layers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.api.v4.resources.agents.get import QGetAgentsV4Item
from app.api.v4.resources.cohorts.get import QGetCohortsV4Item
from app.api.v4.resources.departments.get import QGetDepartmentsV4Item
from app.api.v4.resources.settings.get import QGetSettingsV4Item
from app.api.v4.resources.simulations.get import GetSimulationsBatchV4Item
from app.api.v4.resources.tools.get import QGetToolsV4Item
from app.sql.types import (
    GetProfileContextAccessSqlRow,
    GetSettingsThemeSqlRow,
    QGetProfileContextV4Draft,
    QGetProfileContextV4RoleResource,
    QGetProfileContextV4ThemeTokens,
)
from app.sql.types import (
    GetProfileContextApiResponse as BaseGetProfileContextApiResponse,
)


class GetProfileContextApiResponse(BaseGetProfileContextApiResponse):
    """Extended profile context response with generated artifact map."""

    artifact_has_generation: dict[str, bool] | None = None


@dataclass
class ProfileContextInternalData:
    """Internal profile-context facts graph shared by HTTP and artifacts."""

    access: GetProfileContextAccessSqlRow
    actor_name: str | None
    user_role: str | None
    primary_department_id: UUID | None
    departments: list[QGetDepartmentsV4Item]
    cohorts: list[QGetCohortsV4Item]
    simulations: list[GetSimulationsBatchV4Item]
    drafts: list[QGetProfileContextV4Draft]
    settings: QGetSettingsV4Item | None
    settings_agents: list[QGetAgentsV4Item]
    settings_tools: list[QGetToolsV4Item]
    role_resources: list[QGetProfileContextV4RoleResource]
    settings_theme: GetSettingsThemeSqlRow
    settings_tokens: QGetProfileContextV4ThemeTokens
    earliest_attempt_date: datetime | None
    artifact_has_generation: dict[str, bool]
    pass1_time_ms: float
    pass2_time_ms: float
