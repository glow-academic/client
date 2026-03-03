"""Cohort API types - handcrafted types for cohort endpoints.

These types are used for the cohort API endpoints and include
SQL-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.entries.runs.search import GetRunListViewResponse
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetCohortDraftsEntriesV4Item,
    QGetPersonasV4Item,
)

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
    personas: list[QGetPersonasV4Item] | None = None


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
    personas: list[QGetPersonasV4Item] | None = None


class GetCohortWebsocketResponse(InternalResponseBase):
    """Minimal response for WebSocket handlers (get_cohort_websocket).

    Contains only what's needed for AI generation:
    - Group ID (for existing group context)
    - Optional draft view
    - resource_agent_ids mapping
    - selected resources plus config resources for Jinja context
    """

    entries: "CohortWebsocketEntries | None" = None
    resources: "CohortWebsocketResources"


class CohortWebsocketEntries(BaseModel):
    draft_cohort: QGetCohortDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class CohortWebsocketResources(BaseModel):
    """Hydrated websocket resources — selected resources only plus config chain."""

    names: list[CohortNameResource] | None = None
    descriptions: list[CohortDescriptionResource] | None = None
    flags: list[CohortFlagConfig] | None = None
    departments: list[CohortDepartment] | None = None
    simulations: list[CohortSimulation] | None = None
    simulation_positions: list[CohortSimulationPosition] | None = None
    simulation_availability: list[CohortSimulationAvailability] | None = None
    profiles: list[CohortProfile] | None = None
    profile_personas: list[CohortProfilePersona] | None = None
    personas: list[QGetPersonasV4Item] | None = None


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
    total_count: int | None = None
    import_fields: list[Any] | None = None


# =============================================================================
# Resource Action Types (used by draft endpoint)
# =============================================================================


class CohortResourceAction(BaseModel):
    """Single resource action payload with tool-call metadata."""

    resource_id: UUID | None = None
    tool_id: UUID | None = None


class CohortMultiResourceAction(BaseModel):
    """Multi-resource action payload with tool-call metadata."""

    resource_ids: list[UUID] | None = None
    tool_id: UUID | None = None


# =============================================================================
# SAVE Endpoint Types
# =============================================================================


class SaveCohortFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveCohortItem(BaseModel):
    """Single cohort item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field must
    be provided.
    """

    input_cohort_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
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
    # Value-based fields (for CSV import — resolved to IDs by _resolve_cohort_values)
    is_inactive: bool | None = None
    departments: list[str] | None = None
    simulations: list[str] | None = None
    profiles: list[str] | None = None


class SaveCohortApiRequest(BaseModel):
    """Request model for bulk save cohort endpoint."""

    cohorts: list[SaveCohortItem]
    group_id: UUID | None = None  # Tool tracking context from GET response


class SaveCohortResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    cohort_id: UUID | None = None
    message: str
    errors: list[SaveCohortFieldError] | None = None


class SaveCohortApiResponse(BaseModel):
    """Response model for bulk save cohort endpoint."""

    results: list[SaveCohortResult]


class SaveCohortSqlParams(BaseModel):
    """SQL parameters for save cohort - flat resource IDs."""

    profile_id: UUID
    input_cohort_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    simulation_position_ids: list[UUID] | None = None
    simulation_availability_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    profile_persona_ids: list[UUID] | None = None
    cohorts_resource_id: UUID | None = None

    @classmethod
    def from_request(
        cls,
        request: SaveCohortItem,
        profile_id: UUID,
        cohorts_resource_id: UUID | None = None,
    ) -> "SaveCohortSqlParams":
        return cls(
            profile_id=profile_id,
            input_cohort_id=request.input_cohort_id,
            name_id=request.name_id,
            description_id=request.description_id,
            active_flag_id=request.flag_id,
            department_ids=request.department_ids,
            simulation_ids=request.simulation_ids,
            simulation_position_ids=request.simulation_position_ids,
            simulation_availability_ids=request.simulation_availability_ids,
            profile_ids=request.profile_ids,
            profile_persona_ids=request.profile_persona_ids,
            cohorts_resource_id=cohorts_resource_id,
        )

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution.

        Arrays are passed as-is (None preserved) so SQL COALESCE can
        distinguish 'not provided' (NULL) from 'explicitly empty' ([]).
        """
        return (
            self.profile_id,
            self.input_cohort_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.department_ids,
            self.simulation_ids,
            self.simulation_position_ids,
            self.simulation_availability_ids,
            self.profile_ids,
            self.profile_persona_ids,
            self.cohorts_resource_id,
        )


class SaveCohortSqlRow(BaseModel):
    """SQL row for save cohort."""

    cohort_id: UUID | None = None


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

    id: UUID | None = None
    name: str | None = None
    actor_name: str | None = None


# =============================================================================
# DRAFT Endpoint Types
# =============================================================================


class PatchCohortDraftApiRequest(BaseModel):
    """Request for patching a cohort draft - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    simulation_position_ids: list[UUID] | None = None
    simulation_availability_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    profile_persona_ids: list[UUID] | None = None
    expected_version: int | None = 0


class PatchCohortDraftApiResponse(BaseModel):
    """Response for patching a cohort draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


class PatchCohortDraftSqlParams(BaseModel):
    """SQL params for patch cohort draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: "CohortResourceAction | None" = None
    descriptions: "CohortResourceAction | None" = None
    flags: "CohortResourceAction | None" = None
    departments: "CohortMultiResourceAction | None" = None
    simulations: "CohortMultiResourceAction | None" = None
    simulation_positions: "CohortMultiResourceAction | None" = None
    simulation_availability: "CohortMultiResourceAction | None" = None
    profiles: "CohortMultiResourceAction | None" = None
    profile_personas: "CohortMultiResourceAction | None" = None
    expected_version: int | None = 0

    @classmethod
    def from_request(
        cls, request: PatchCohortDraftApiRequest, profile_id: UUID
    ) -> "PatchCohortDraftSqlParams":
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=CohortResourceAction(resource_id=request.name_id),
            descriptions=CohortResourceAction(resource_id=request.description_id),
            flags=CohortResourceAction(resource_id=request.flag_id),
            departments=CohortMultiResourceAction(resource_ids=request.department_ids),
            simulations=CohortMultiResourceAction(resource_ids=request.simulation_ids),
            simulation_positions=CohortMultiResourceAction(
                resource_ids=request.simulation_position_ids
            ),
            simulation_availability=CohortMultiResourceAction(
                resource_ids=request.simulation_availability_ids
            ),
            profiles=CohortMultiResourceAction(resource_ids=request.profile_ids),
            profile_personas=CohortMultiResourceAction(
                resource_ids=request.profile_persona_ids
            ),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def single(
            a: CohortResourceAction | None,
        ) -> tuple[UUID | None, UUID | None, UUID | None]:
            return (a.resource_id, a.tool_id, a.tool_id) if a else (None, None, None)

        def multi(
            a: CohortMultiResourceAction | None,
        ) -> tuple[list[UUID] | None, UUID | None, UUID | None]:
            return (a.resource_ids, a.tool_id, a.tool_id) if a else (None, None, None)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.departments),
            multi(self.simulations),
            multi(self.simulation_positions),
            multi(self.simulation_availability),
            multi(self.profiles),
            multi(self.profile_personas),
            self.expected_version,
        )


class PatchCohortDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


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
