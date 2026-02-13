"""Types for this resource endpoint."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class QGetSettingsV4Auth(BaseModel):
    """Auth item in settings."""

    auth_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    slug: str | None = None


class QGetSettingsV4Provider(BaseModel):
    """Provider item in settings."""

    provider_id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None


class QGetSettingsV4Item(BaseModel):
    """Settings item returned from get endpoint."""

    settings_id: str | None = None
    created_at: datetime | None = None
    active: bool | None = None
    name: str | None = None
    description: str | None = None
    primary_color: str | None = None
    accent: str | None = None
    background: str | None = None
    surface: str | None = None
    success: str | None = None
    warning: str | None = None
    error: str | None = None
    sidebar_background: str | None = None
    sidebar_primary: str | None = None
    chart1: str | None = None
    chart2: str | None = None
    chart3: str | None = None
    chart4: str | None = None
    chart5: str | None = None
    guest_login_enabled: bool | None = None
    success_threshold: int | None = None
    warning_threshold: int | None = None
    danger_threshold: int | None = None
    auth_ids: list[str] | None = None
    auths: list[QGetSettingsV4Auth] | None = None
    provider_ids: list[str] | None = None
    providers: list[QGetSettingsV4Provider] | None = None


class GetSettingsApiRequest(BaseModel):
    """Request for getting settings by IDs."""

    ids: list[UUID] = []


class GetSettingsApiResponse(BaseModel):
    """Response for getting settings."""

    items: list[QGetSettingsV4Item] | None = None


class GetSettingsSqlParams(BaseModel):
    """SQL parameters for get settings."""

    ids: list[UUID] = []

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.ids,)


class GetSettingsSqlRow(BaseModel):
    """SQL row for get settings."""

    items: list[QGetSettingsV4Item] | None = None


class SearchSettingsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    department_ids: list[UUID] = []
    # Artifact boolean filters
    department: bool = False
    setting: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.department_ids,
            self.department,
            self.setting,
        )
