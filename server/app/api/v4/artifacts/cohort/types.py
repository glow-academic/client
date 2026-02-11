"""Cohort API types - handcrafted types for cohort endpoints.

These types are used for the cohort API endpoints and include
SQL-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.views.drafts.types import DraftCohortViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetModelsV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
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


class CohortFlagResource(BaseModel):
    """Flag resource for cohort."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
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
    time_limit: int | None = None
    generated: bool | None = None


class CohortSimulationPosition(BaseModel):
    """Simulation position for cohort."""

    simulation_id: UUID | None = None
    value: int | None = None
    generated: bool | None = None
    mcp: bool | None = None


# =============================================================================
# Resource Buckets (for WebSocket Jinja context)
# =============================================================================


class CohortResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[CohortNameResource] | None = None
    descriptions: list[CohortDescriptionResource] | None = None
    flags: list[CohortFlagResource] | None = None
    departments: list[CohortDepartment] | None = None
    simulations: list[CohortSimulation] | None = None
    simulation_positions: list[CohortSimulationPosition] | None = None


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
    draft_id: UUID | None = None


class BaseResourceSection(BaseModel):
    """Common metadata fields for all cohort resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class CohortNameSection(BaseResourceSection):
    resource: CohortNameResource | None = None
    resources: list[CohortNameResource] | None = None


class CohortDescriptionSection(BaseResourceSection):
    resource: CohortDescriptionResource | None = None
    resources: list[CohortDescriptionResource] | None = None


class CohortFlagSection(BaseResourceSection):
    resource: CohortFlagResource | None = None
    resources: list[CohortFlagResource] | None = None


class CohortDepartmentSection(BaseResourceSection):
    current: list[CohortDepartment] | None = None
    resources: list[CohortDepartment] | None = None


class CohortSimulationSection(BaseResourceSection):
    current: list[CohortSimulation] | None = None
    resources: list[CohortSimulation] | None = None


class CohortSimulationPositionSection(BaseResourceSection):
    current: list[CohortSimulationPosition] | None = None
    resources: list[CohortSimulationPosition] | None = None


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

    names: CohortNameSection | None = None
    descriptions: CohortDescriptionSection | None = None
    flags: CohortFlagSection | None = None
    departments: CohortDepartmentSection | None = None
    simulations: CohortSimulationSection | None = None
    simulation_positions: CohortSimulationPositionSection | None = None


class GetCohortWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_cohort_websocket).

    Contains only what's needed for AI generation:
    - Group ID (for existing group context)
    - Optional draft view
    - resource_agent_ids mapping
    - selected resources plus config resources for Jinja context
    """

    group_id: UUID | None = None
    views: "CohortWebsocketViews | None" = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    resources: "CohortWebsocketResources"


class CohortWebsocketViews(BaseModel):
    draft_cohort: DraftCohortViewItem | None = None


class CohortWebsocketResources(BaseModel):
    """Hydrated websocket resources — selected resources only plus config chain."""

    names: list[CohortNameResource] | None = None
    descriptions: list[CohortDescriptionResource] | None = None
    flags: list[CohortFlagResource] | None = None
    departments: list[CohortDepartment] | None = None
    simulations: list[CohortSimulation] | None = None
    simulation_positions: list[CohortSimulationPosition] | None = None

    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


# =============================================================================
# LIST Endpoint Types
# =============================================================================


class ListCohortApiCohort(BaseModel):
    """Cohort item in list response with SQL-computed permissions."""

    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
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


class ListCohortApiOption(BaseModel):
    """Option for facet filtering."""

    value: str | None = None
    label: str | None = None


class ListCohortApiResponse(BaseModel):
    """Response for listing cohorts."""

    actor_name: str | None = None
    user_role: str | None = None
    cohorts: list[ListCohortApiCohort] | None = None
    profiles: list[ListCohortApiProfile] | None = None
    simulations: list[ListCohortApiSimulation] | None = None
    departments: list[ListCohortApiDepartment] | None = None


# =============================================================================
# SAVE Endpoint Types
# =============================================================================


class CohortResourceAction(BaseModel):
    """Single resource action payload with tool-call metadata."""

    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class CohortMultiResourceAction(BaseModel):
    """Multi-resource action payload with tool-call metadata."""

    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveCohortApiRequest(BaseModel):
    """Request for saving a cohort - nested resource actions."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_cohort_id: UUID | None = None  # For update mode

    names: "CohortResourceAction"
    descriptions: "CohortResourceAction"
    flags: "CohortResourceAction"
    departments: "CohortMultiResourceAction"
    simulations: "CohortMultiResourceAction"
    simulation_positions: "CohortMultiResourceAction"
    simulation_position_values: list[int] | None = None


class SaveCohortApiResponse(BaseModel):
    """Response for saving a cohort."""

    cohort_id: UUID | None = None
    actor_name: str | None = None


class SaveCohortSqlParams(BaseModel):
    """SQL parameters for save cohort."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_cohort_id: UUID | None = None  # For update mode

    names: "CohortResourceAction"
    descriptions: "CohortResourceAction"
    flags: "CohortResourceAction"
    departments: "CohortMultiResourceAction"
    simulations: "CohortMultiResourceAction"
    simulation_positions: "CohortMultiResourceAction"
    simulation_position_values: list[int] | None = None

    @classmethod
    def from_request(
        cls, request: SaveCohortApiRequest, profile_id: UUID
    ) -> "SaveCohortSqlParams":
        return cls(
            profile_id=profile_id,
            group_id=request.group_id,
            input_cohort_id=request.input_cohort_id,
            names=request.names,
            descriptions=request.descriptions,
            flags=request.flags,
            departments=request.departments,
            simulations=request.simulations,
            simulation_positions=request.simulation_positions,
            simulation_position_values=request.simulation_position_values,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""

        def single(
            a: CohortResourceAction,
        ) -> tuple[UUID | None, UUID | None, UUID | None]:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(
            a: CohortMultiResourceAction,
        ) -> tuple[list[UUID] | None, UUID | None, UUID | None]:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_cohort_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.departments),
            multi(self.simulations),
            multi(self.simulation_positions),
            self.simulation_position_values,
        )


class SaveCohortSqlRow(BaseModel):
    """SQL row for save cohort."""

    cohort_id: UUID | None = None
    actor_name: str | None = None


# =============================================================================
# DELETE Endpoint Types
# =============================================================================


class DeleteCohortApiRequest(BaseModel):
    """Request for deleting a cohort."""

    cohort_id: UUID


class DeleteCohortApiResponse(BaseModel):
    """Response for deleting a cohort."""

    usage_count: int | None = None
    deleted: bool | None = None
    title: str | None = None
    actor_name: str | None = None


# =============================================================================
# DUPLICATE Endpoint Types
# =============================================================================


class DuplicateCohortApiRequest(BaseModel):
    """Request for duplicating a cohort."""

    cohort_id: UUID


class DuplicateCohortApiResponse(BaseModel):
    """Response for duplicating a cohort."""

    id: UUID | None = None
    title: str | None = None
    actor_name: str | None = None


# =============================================================================
# DRAFT Endpoint Types
# =============================================================================


class PatchCohortDraftApiRequest(BaseModel):
    """Request for patching a cohort draft."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: "CohortResourceAction | None" = None
    descriptions: "CohortResourceAction | None" = None
    flags: "CohortResourceAction | None" = None
    departments: "CohortMultiResourceAction | None" = None
    simulations: "CohortMultiResourceAction | None" = None
    simulation_positions: "CohortMultiResourceAction | None" = None
    simulation_position_values: list[int] | None = None
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
    simulation_position_values: list[int] | None = None
    expected_version: int | None = 0

    @classmethod
    def from_request(
        cls, request: PatchCohortDraftApiRequest, profile_id: UUID
    ) -> "PatchCohortDraftSqlParams":
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=request.names,
            descriptions=request.descriptions,
            flags=request.flags,
            departments=request.departments,
            simulations=request.simulations,
            simulation_positions=request.simulation_positions,
            simulation_position_values=request.simulation_position_values,
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def single(
            a: CohortResourceAction | None,
        ) -> tuple[UUID | None, UUID | None, UUID | None]:
            return (
                (a.resource_id, a.create_tool_id, a.link_tool_id)
                if a
                else (None, None, None)
            )

        def multi(
            a: CohortMultiResourceAction | None,
        ) -> tuple[list[UUID] | None, UUID | None, UUID | None]:
            return (
                (a.resource_ids, a.create_tool_id, a.link_tool_id)
                if a
                else (None, None, None)
            )

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
            self.simulation_position_values,
            self.expected_version,
        )


class PatchCohortDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# =============================================================================
# SQL Row Types (for internal use)
# =============================================================================
# Note: GetCohortAccessSqlParams, GetCohortAccessSqlRow, GetCohortIdsSqlParams,
# and GetCohortIdsSqlRow are now auto-generated in app/sql/types.py from the
# corresponding SQL files in app/sql/v4/queries/cohorts/


class ListCohortSqlCohort(BaseModel):
    """Raw cohort from SQL with SQL-computed permissions."""

    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
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
