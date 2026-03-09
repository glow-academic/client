"""Cohort API types - handcrafted types for cohort endpoints.

These types are used for the cohort API endpoints and include
SQL-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.infra.cohort_create import CreateCohortItem
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.resources.personas.types import GetPersonaResponse

# =============================================================================
# Resource Types (imported from SQL types for reuse)
# =============================================================================


class CohortNameResource(BaseModel):
    """Name resource for cohort."""

    id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class CohortDescriptionResource(BaseModel):
    """Description resource for cohort."""

    id: UUID | None = None
    description: str | None = None
    generated: bool | None = None


class CohortFlagConfig(BaseModel):
    """Flag config for cohort — matches client FlagConfig interface."""

    key: str | None = None
    label: str | None = None
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool | None = None
    required: bool | None = None
    generated: bool | None = None


class CohortDepartment(BaseModel):
    """Department for cohort."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class CohortSimulation(BaseModel):
    """Simulation for cohort."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class CohortSimulationPosition(BaseModel):
    """Simulation position for cohort."""

    simulation_id: UUID | None = None
    value: int | None = None
    generated: bool | None = None
    mcp: bool | None = None


class CohortSimulationAvailability(BaseModel):
    """Simulation availability for cohort."""

    id: UUID | None = None
    simulation_id: UUID | None = None
    time: datetime | None = None
    type: str | None = None
    generated: bool | None = None
    mcp: bool | None = None


class CohortProfile(BaseModel):
    """Profile for cohort."""

    profile_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    mcp: bool | None = None


class CohortProfilePersona(BaseModel):
    """Profile persona for cohort."""

    id: UUID | None = None
    profile_id: UUID | None = None
    persona_id: UUID | None = None
    generated: bool | None = None
    mcp: bool | None = None


# =============================================================================
# Resource Buckets (for WebSocket Jinja context)
# =============================================================================


class CohortResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[CohortNameResource] | None = None
    descriptions: list[CohortDescriptionResource] | None = None
    flags: list[CohortFlagConfig] | None = None
    departments: list[CohortDepartment] | None = None
    simulations: list[CohortSimulation] | None = None
    simulation_positions: list[CohortSimulationPosition] | None = None
    simulation_availability: list[CohortSimulationAvailability] | None = None
    profiles: list[CohortProfile] | None = None
    profile_personas: list[CohortProfilePersona] | None = None
    personas: list[GetPersonaResponse] | None = None


class CohortResources(BaseModel):
    """Full resources + current selections."""

    resources: CohortResourceBucket | None = None
    current: CohortResourceBucket | None = None


# =============================================================================
# GET Endpoint Types
# =============================================================================


class GetCohortApiRequest(BaseModel):
    """Request for getting a single cohort."""

    cohort_id: UUID | None = None
    descriptions_search: str | None = None
    simulation_search: str | None = None
    simulation_show_selected: bool | None = None
    profile_search: str | None = None
    profile_show_selected: bool | None = None
    draft_id: UUID | None = None
    group_id: UUID | None = None


class CohortNameSection(BaseResourceSection):
    resource: CohortNameResource | None = None
    resources: list[CohortNameResource] | None = None


class CohortDescriptionSection(BaseResourceSection):
    resource: CohortDescriptionResource | None = None
    resources: list[CohortDescriptionResource] | None = None


class CohortFlagSection(BaseResourceSection):
    resource: CohortFlagConfig | None = None
    resources: list[CohortFlagConfig] | None = None


class CohortDepartmentSection(BaseResourceSection):
    current: list[CohortDepartment] | None = None
    resources: list[CohortDepartment] | None = None


class CohortSimulationSection(BaseResourceSection):
    current: list[CohortSimulation] | None = None
    resources: list[CohortSimulation] | None = None


class CohortSimulationPositionSection(BaseResourceSection):
    current: list[CohortSimulationPosition] | None = None
    resources: list[CohortSimulationPosition] | None = None


class CohortSimulationAvailabilitySection(BaseResourceSection):
    current: list[CohortSimulationAvailability] | None = None
    resources: list[CohortSimulationAvailability] | None = None


class CohortProfileSection(BaseResourceSection):
    current: list[CohortProfile] | None = None
    resources: list[CohortProfile] | None = None


class CohortProfilePersonaSection(BaseResourceSection):
    current: list[CohortProfilePersona] | None = None
    resources: list[CohortProfilePersona] | None = None


class GetCohortApiResponse(BaseModel):
    """Response for getting a single cohort."""

    # Context
    actor_name: str | None = None
    cohort_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    simulations_step_show_ai_generate: bool | None = None
    profiles_step_show_ai_generate: bool | None = None

    names: CohortNameSection | None = None
    descriptions: CohortDescriptionSection | None = None
    flags: CohortFlagSection | None = None
    departments: CohortDepartmentSection | None = None
    simulations: CohortSimulationSection | None = None
    simulation_positions: CohortSimulationPositionSection | None = None
    simulation_availability: CohortSimulationAvailabilitySection | None = None
    profiles: CohortProfileSection | None = None
    profile_personas: CohortProfilePersonaSection | None = None
    personas: list[GetPersonaResponse] | None = None


# =============================================================================
# LIST Endpoint Types
# =============================================================================


class ListCohortApiCohort(BaseModel):
    """Cohort item in list response with Python-computed permissions."""

    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    is_inactive: bool | None = None
    generated: bool | None = None
    mcp: bool | None = None
    department_ids: list[str] | None = None
    profile_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    usage_count: int | None = None
    num_members: int | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None
    can_leave: bool | None = None
    updated_at: datetime | None = None


class ListCohortApiProfile(BaseModel):
    """Profile in list response."""

    profile_id: UUID | None = None
    name: str | None = None
    description: str | None = None


class ListCohortApiSimulation(BaseModel):
    """Simulation in list response."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None


class ListCohortApiDepartment(BaseModel):
    """Department in list response."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None


class ListCohortApiResponse(BaseModel):
    """Response for listing cohorts."""

    actor_name: str | None = None
    user_role: str | None = None
    cohorts: list[ListCohortApiCohort] | None = None
    profiles: list[ListCohortApiProfile] | None = None
    simulations: list[ListCohortApiSimulation] | None = None
    departments: list[ListCohortApiDepartment] | None = None
    simulation_filter: "ListFilterSection | None" = None
    profile_filter: "ListFilterSection | None" = None
    department_filter: "ListFilterSection | None" = None
    flag_filter: "ListFilterSection | None" = None
    total_count: int | None = None
    import_fields: list[Any] | None = None


# =============================================================================
# Resource Action Types (used by draft endpoint)
# =============================================================================


# =============================================================================
# Shared Create/Update Types
# =============================================================================


class CohortFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class CohortResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    cohort_id: UUID | None = None
    message: str
    errors: list[CohortFieldError] | None = None


# =============================================================================
# Create Endpoint Types
# =============================================================================


class CreateCohortApiRequest(BaseModel):
    """Request model for bulk create cohort endpoint."""

    cohorts: list[CreateCohortItem]
    group_id: UUID | None = None


class CreateCohortApiResponse(BaseModel):
    """Response model for bulk create cohort endpoint."""

    results: list[CohortResultItem]


# =============================================================================
# Update Endpoint Types
# =============================================================================


class UpdateCohortItem(BaseModel):
    """Single cohort item for update — cohort_id required, all fields optional."""

    cohort_id: UUID  # Required — which cohort to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    # Single-select flag
    flag_id: UUID | None = None
    # Multi-select IDs
    department_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    simulation_position_ids: list[UUID] | None = None
    simulation_availability_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    profile_persona_ids: list[UUID] | None = None
    # Value-based fields (for CSV import — resolved to IDs)
    is_inactive: bool | None = None
    departments: list[str] | None = None
    simulations: list[str] | None = None
    profiles: list[str] | None = None


class UpdateCohortApiRequest(BaseModel):
    """Request model for bulk update cohort endpoint."""

    cohorts: list[UpdateCohortItem]
    group_id: UUID | None = None


class UpdateCohortApiResponse(BaseModel):
    """Response model for bulk update cohort endpoint."""

    results: list[CohortResultItem]


class SaveCohortFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


# =============================================================================
# DELETE Endpoint Types
# =============================================================================


class DeleteCohortApiRequest(BaseModel):
    """Request model for bulk delete cohort endpoint."""

    cohort_ids: list[UUID]


class DeleteCohortResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    cohort_id: UUID
    message: str


class DeleteCohortApiResponse(BaseModel):
    """Response model for bulk delete cohort endpoint."""

    results: list[DeleteCohortResult]


# =============================================================================
# DUPLICATE Endpoint Types
# =============================================================================


class DuplicateCohortApiRequest(BaseModel):
    """Request for duplicating a cohort."""

    cohort_id: UUID


class DuplicateCohortApiResponse(BaseModel):
    """Response for duplicating a cohort."""

    success: bool
    cohort_id: UUID
    message: str


# =============================================================================
# DRAFT Endpoint Types
# =============================================================================


class DraftSimulationPositionValue(BaseModel):
    """Value for creating a simulation_position resource via draft."""

    simulation_id: UUID
    value: int


class DraftSimulationAvailabilityValue(BaseModel):
    """Value for creating a simulation_availability resource via draft."""

    simulation_id: UUID
    time: datetime
    type: str


class DraftProfilePersonaValue(BaseModel):
    """Value for creating a profile_persona resource via draft."""

    profile_id: UUID
    persona_id: UUID


class PatchCohortDraftApiRequest(BaseModel):
    """Request model for new-style cohort draft endpoint.

    Dual-mode for creatable resources:
      - Single-select: name/name_id, description/description_id
      - Multi-select compound: simulation_positions, simulation_availability,
        profile_personas (values create resources, created IDs merged with existing IDs)
    ID-only for non-creatable resources:
      - flag_id, department_ids, simulation_ids, profile_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID | None = None
    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    description: str | None = None
    description_id: UUID | None = None

    # Non-creatable — ID-only
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None

    # Creatable multi-select compound — values create resources, IDs merged
    simulation_position_ids: list[UUID] | None = None
    simulation_positions: list[DraftSimulationPositionValue] | None = None
    simulation_availability_ids: list[UUID] | None = None
    simulation_availability: list[DraftSimulationAvailabilityValue] | None = None
    profile_persona_ids: list[UUID] | None = None
    profile_personas: list[DraftProfilePersonaValue] | None = None


class CohortDraftFormState(BaseModel):
    """Full form state after draft patch — server is source of truth.

    Client replaces its local form state with this after every successful patch.
    """

    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] = []
    simulation_ids: list[UUID] = []
    simulation_position_ids: list[UUID] = []
    simulation_availability_ids: list[UUID] = []
    profile_ids: list[UUID] = []
    profile_persona_ids: list[UUID] = []


class PatchCohortDraftApiResponse(BaseModel):
    """Response model for new-style cohort draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: CohortDraftFormState | None = None


# =============================================================================
# EXPORT Endpoint Types
# =============================================================================


class ExportCohortApiRequest(BaseModel):
    """Request model for export cohort endpoint."""

    search: str | None = None
    filter_simulation_ids: list[str] | None = None
    filter_profile_ids: list[str] | None = None
    filter_department_ids: list[str] | None = None


class ExportCohortApiResponse(BaseModel):
    """Response model for export cohort endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


# =============================================================================
# SQL Row Types (for internal use)
# =============================================================================
# Note: GetCohortAccessSqlParams, GetCohortAccessSqlRow, GetCohortIdsSqlParams,
# and GetCohortIdsSqlRow are now auto-generated in app/sql/types.py from the
# corresponding SQL files in app/v5/sql/queries/cohorts/


class ListCohortSqlCohort(BaseModel):
    """Raw cohort from SQL — permissions computed in Python."""

    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    is_inactive: bool | None = None
    department_ids: list[str] | None = None
    profile_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    usage_count: int | None = None
    num_members: int | None = None
    is_member: bool | None = None
    generated: bool | None = None
    mcp: bool | None = None
    updated_at: datetime | None = None
