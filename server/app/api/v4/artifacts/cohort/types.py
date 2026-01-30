"""Cohort API types - handcrafted types for cohort endpoints.

These types are used for the cohort API endpoints and include
Python-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

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
    icon_id: UUID | None = None
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
# GET Endpoint Types
# =============================================================================


class GetCohortApiRequest(BaseModel):
    """Request for getting a single cohort."""

    cohort_id: UUID | None = None
    descriptions_search: str | None = None
    simulation_search: str | None = None
    simulation_show_selected: bool | None = None
    current_simulation_ids: list[UUID] | None = None
    draft_id: UUID | None = None


class GetCohortApiResponse(BaseModel):
    """Response for getting a single cohort."""

    # Required fields
    actor_name: str | None = None
    cohort_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    # Name resource
    name_id: UUID | None = None
    name_resource: CohortNameResource | None = None
    show_name: bool | None = None
    name_agent_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    names: list[CohortNameResource] | None = None

    # Description resource
    description_id: UUID | None = None
    description_resource: CohortDescriptionResource | None = None
    show_description: bool | None = None
    description_agent_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    descriptions: list[CohortDescriptionResource] | None = None

    # Flag resource
    active_flag_id: UUID | None = None
    flag_resource: CohortFlagResource | None = None
    show_flag: bool | None = None
    flag_agent_id: UUID | None = None
    flag_required: bool | None = None

    # Departments
    department_ids: list[UUID] | None = None
    department_resources: list[CohortDepartment] | None = None
    show_departments: bool | None = None
    departments_agent_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments: list[CohortDepartment] | None = None

    # Simulations
    simulation_ids: list[UUID] | None = None
    simulation_resources: list[CohortSimulation] | None = None
    show_simulations: bool | None = None
    simulations_agent_id: UUID | None = None
    simulations_required: bool | None = None
    simulation_suggestions: list[UUID] | None = None
    simulations: list[CohortSimulation] | None = None

    # Simulation positions
    simulation_positions: list[CohortSimulationPosition] | None = None
    show_simulation_positions: bool | None = None
    simulation_positions_agent_id: UUID | None = None
    simulation_positions_required: bool | None = None

    # Multi-resource combination agent IDs
    basic_agent_id: UUID | None = None
    general_agent_id: UUID | None = None


# =============================================================================
# LIST Endpoint Types
# =============================================================================


class ListCohortApiCohort(BaseModel):
    """Cohort item in list response with Python-computed permissions."""

    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    profile_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    usage_count: int | None = None
    num_members: int | None = None
    updated_at: datetime | None = None

    # Python-computed permissions
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None
    can_leave: bool | None = None


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
    time_limit: int | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[str] | None = None


class ListCohortApiScenario(BaseModel):
    """Scenario in list response."""

    scenario_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    persona_ids: list[str] | None = None
    persona_mapping: dict[str, Any] | None = None


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
    scenarios: list[ListCohortApiScenario] | None = None
    simulation_scenario_mapping: dict[str, list[str]] | None = None
    departments: list[ListCohortApiDepartment] | None = None


# =============================================================================
# SAVE Endpoint Types
# =============================================================================


class SaveCohortApiRequest(BaseModel):
    """Request for saving a cohort - accepts form data directly (no draft_id)."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_cohort_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None

    # Special: simulation position values for ordering
    simulation_position_values: list[int] | None = None


class SaveCohortApiResponse(BaseModel):
    """Response for saving a cohort."""

    cohort_id: UUID | None = None
    actor_name: str | None = None


class SaveCohortSqlParams(BaseModel):
    """SQL parameters for save cohort - accepts form data directly (no draft_id)."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_cohort_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None

    # Special: simulation position values for ordering
    simulation_position_values: list[int] | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_cohort_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.department_ids,
            self.simulation_ids,
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
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    simulation_position_values: list[int] | None = None
    expected_version: int | None = 0


class PatchCohortDraftApiResponse(BaseModel):
    """Response for patching a cohort draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# =============================================================================
# SQL Row Types (for internal use)
# =============================================================================


class ListCohortSqlCohort(BaseModel):
    """Raw cohort from SQL without computed permissions."""

    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    profile_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    usage_count: int | None = None
    num_members: int | None = None
    is_member: bool | None = None
    updated_at: datetime | None = None
