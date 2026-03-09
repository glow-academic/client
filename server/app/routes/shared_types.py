"""Shared Pydantic types used across route layers.

These were previously auto-generated in app.sql.types — now hand-maintained.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Profile context types
# ---------------------------------------------------------------------------


class QGetProfileContextV4RoleResource(BaseModel):
    role: str | None = None
    name: str | None = None
    description: str | None = None
    icon_value: str | None = None
    color_hex: str | None = None


class QGetProfileContextV4Department(BaseModel):
    department_id: UUID | None = None
    title: str | None = None
    description: str | None = None
    active: bool | None = None
    is_primary: bool | None = None


class QGetProfileContextV4Cohort(BaseModel):
    cohort_id: UUID | None = None
    title: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None


class QGetProfileContextV4ThemeTokens(BaseModel):
    background: str | None = None
    foreground: str | None = None
    card: str | None = None
    card_foreground: str | None = None
    popover: str | None = None
    popover_foreground: str | None = None
    primary_color: str | None = None
    primary_foreground: str | None = None
    secondary: str | None = None
    secondary_foreground: str | None = None
    muted: str | None = None
    muted_foreground: str | None = None
    accent: str | None = None
    accent_foreground: str | None = None
    destructive: str | None = None
    border: str | None = None
    input: str | None = None
    ring: str | None = None
    success: str | None = None
    success_foreground: str | None = None
    warning: str | None = None
    warning_foreground: str | None = None
    info: str | None = None
    info_foreground: str | None = None
    chart1: str | None = None
    chart2: str | None = None
    chart3: str | None = None
    chart4: str | None = None
    chart5: str | None = None
    sidebar: str | None = None
    sidebar_foreground: str | None = None
    sidebar_primary: str | None = None
    sidebar_primary_foreground: str | None = None
    sidebar_accent: str | None = None
    sidebar_accent_foreground: str | None = None
    sidebar_border: str | None = None
    sidebar_ring: str | None = None


# ---------------------------------------------------------------------------
# Department / Cohort resource types
# ---------------------------------------------------------------------------


class QGetDepartmentsV4Item(BaseModel):
    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class QGetCohortsV4Item(BaseModel):
    cohort_id: UUID | None = None
    title: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    profile_ids: list[str] | None = None
    profile_persona_ids: list[str] | None = None
    simulation_position_ids: list[str] | None = None
    simulation_availability_ids: list[str] | None = None


# ---------------------------------------------------------------------------
# Settings types
# ---------------------------------------------------------------------------


class QGetSettingsV4Auth(BaseModel):
    auth_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    slug: str | None = None


class QGetSettingsV4Item(BaseModel):
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
    provider_key_ids: list[UUID] | None = None


# ---------------------------------------------------------------------------
# Config chain types (agents, systems, models, providers, tools, args)
# ---------------------------------------------------------------------------


class QGetSystemsV4Item(BaseModel):
    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    agent_ids: list[UUID] | None = None
    active: bool | None = None
    generated: bool | None = None


class QGetAgentsV4Item(BaseModel):
    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    model_id: UUID | None = None
    temperature: float | None = None
    reasoning: str | None = None
    tool_ids: list[UUID] | None = None
    quality: str | None = None
    voices: list[str] | None = None
    prompt_id: UUID | None = None
    instruction_ids: list[UUID] | None = None
    active: bool | None = None
    generated: bool | None = None


class QGetModelsV4Item(BaseModel):
    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    provider_id: UUID | None = None
    modality_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
    active: bool | None = None
    generated: bool | None = None


class QGetProvidersV4Item(BaseModel):
    id: UUID | None = None
    value: str | None = None
    name: str | None = None
    description: str | None = None
    endpoint: str | None = None
    key: str | None = None
    active: bool | None = None
    generated: bool | None = None


class QGetToolsV4Item(BaseModel):
    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    args_ids: list[UUID] | None = None
    args_output_ids: list[UUID] | None = None
    operation: str | None = None
    resources: list[str] | None = None
    entries: list[str] | None = None
    artifacts: list[str] | None = None


class QGetArgsV4Item(BaseModel):
    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    field_type: str | None = None
    required: bool | None = None
    default_value: str | None = None
    generated: bool | None = None


class QGetArgsOutputsV4Item(BaseModel):
    id: UUID | None = None
    args_id: UUID | None = None
    name: str | None = None
    template: str | None = None
    generated: bool | None = None


class QGetProfilesV4Item(BaseModel):
    profile_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    emails: list[str] | None = None
    primary_email: str | None = None
    requests_per_day: int | None = None


# ---------------------------------------------------------------------------
# Tool config type (used by generation infra)
# ---------------------------------------------------------------------------


class IGetTextRunContextAndCreateRunV4Tool(BaseModel):
    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    tool_type: str | None = None
    agent_role: str | None = None
    arguments: Any | None = None
    argument_descriptions: Any | None = None
    argument_defaults: Any | None = None
    active: bool | None = None


# ---------------------------------------------------------------------------
# Auth route request/response types
# ---------------------------------------------------------------------------


class GetProfileContextApiRequest(BaseModel):
    department_id: str | None = None


class GetProfileByEmailApiRequest(BaseModel):
    email: str


class GetProfileByEmailApiResponse(BaseModel):
    profile_id: UUID | None = None
    name: str | None = None
    emails: list[str] | None = None
    primary_email: str | None = None
    role: str | None = None
    active: bool | None = None
    req_per_day: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    primary_department_id: UUID | None = None
    actor_name: str | None = None


class GetKeyForDecryptApiRequest(BaseModel):
    key_id: UUID


class GetKeyForDecryptApiResponse(BaseModel):
    key: str | None = None
    name: str | None = None
    actor_name: str | None = None


class CreateOrUpdateProfileApiRequest(BaseModel):
    name: str
    emails: list[str]
    role: str
    current_profile_id: UUID | None = None
    primary_email_index: int | None = 0
    active: bool | None = True
    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    profile_id_new: UUID | None = None


class CreateOrUpdateProfileApiResponse(BaseModel):
    profile_id: UUID | None = None
    created: bool | None = None
    session_id: UUID | None = None


class CreateEmulationGrantApiRequest(BaseModel):
    requester_profile_id: UUID
    target_profile_id: UUID
    ttl_minutes: int | None = 120
    signin_base_url: str | None = None
    callback_url: str | None = None
    idp_alias: str | None = None
    return_url: str | None = None
    keycloak_public_url: str | None = None
    keycloak_client_id: str | None = None
    origin: str | None = None
    prefix: str | None = None


class CreateEmulationGrantApiResponse(BaseModel):
    allowed: bool | None = None
    reason: str | None = None
    actor_name: str | None = None
    grant_id: UUID | None = None
    expires_at: datetime | None = None
    target_profile_id: UUID | None = None
    redirect_url: str | None = None
    logout_url: str | None = None
    emulate_page_url: str | None = None


class SearchSimulatableProfilesApiRequest(BaseModel):
    limit_count: int
    query: str


class QSearchSimulatableProfilesV4Profile(BaseModel):
    profile_id: UUID | None = None
    name: str | None = None
    emails: list[str] | None = None
    primary_email: str | None = None
    role: str | None = None
    active: bool | None = None
    req_per_day: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    primary_department_id: UUID | None = None


class SearchSimulatableProfilesApiResponse(BaseModel):
    actor_name: str | None = None
    profiles: list[QSearchSimulatableProfilesV4Profile] | None = None
