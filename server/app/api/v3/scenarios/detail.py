"""Scenario detail endpoint - v3 API following DHH principles."""

import json
import uuid
from collections.abc import Sequence
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetScenarioDetailApiRequest,
    GetScenarioDetailApiResponse,
    GetScenarioDetailSqlParams,
    GetScenarioDetailSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/scenarios/get_scenario_detail_complete.sql"


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item - extends MappingItem with optional entity ID arrays."""

    name: str
    description: str
    scenario_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    persona_ids: list[str] | None = None
    document_ids: list[str] | None = None
    rubric_ids: list[str] | None = None
    parameter_ids: list[str] | None = None
    parameter_item_ids: list[str] | None = None
    field_ids: list[str] | None = None
    agent_ids: list[str] | None = None
    staff_ids: list[str] | None = None
    cohort_ids: list[str] | None = None


class PersonaMappingItem(BaseModel):
    """Persona mapping item with custom color and icon fields."""

    name: str
    description: str
    color: str
    icon: str
    image_model: bool | None = None
    parameter_ids: list[str] | None = None
    field_ids: list[str] | None = None
    example: str | None = None


class DocumentMappingItem(BaseModel):
    """Document mapping item - extends MappingItem with file metadata."""

    name: str
    description: str
    filePath: str | None = None
    mimeType: str | None = None
    parameter_ids: list[str] | None = None
    field_ids: list[str] | None = None
    parent_document_id: str | None = None


class FieldMappingItem(BaseModel):
    """Field mapping item with parameter context."""

    name: str
    description: str
    parameter_id: str
    parameter_name: str
    conditional_parameter_ids: list[str] | None = None


class ParameterMappingItem(BaseModel):
    """Parameter mapping item."""

    name: str
    description: str
    numerical: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool = False
    video_parameter: bool = False


class ObjectiveMappingItem(BaseModel):
    """Objective mapping item."""

    name: str
    description: str


class SimulationMappingItem(BaseModel):
    """Simulation mapping item."""

    name: str
    description: str
    time_limit: int | None = None
    department_ids: list[str] | None = None


class AgentMappingItem(BaseModel):
    """Agent mapping item with role information."""

    name: str
    description: str
    roles: list[str]


# Type aliases for Dict mappings
DepartmentMapping = dict[str, DepartmentMappingItem]
PersonaMapping = dict[str, PersonaMappingItem]
DocumentMapping = dict[str, DocumentMappingItem]
FieldMapping = dict[str, FieldMappingItem]
ParameterMapping = dict[str, ParameterMappingItem]
ObjectiveMapping = dict[str, ObjectiveMappingItem]
SimulationMapping = dict[str, SimulationMappingItem]
AgentMapping = dict[str, AgentMappingItem]


def preserve_order_union(
    base_items: list[str],
    additional_items: list[str],
) -> list[str]:
    """
    Union two lists while preserving order from base_items, then appending any additional items.
    This replaces set() operations that lose order from SQL queries.
    """
    seen = set()
    result = []
    # First, add base_items in order
    for item in base_items:
        if item not in seen:
            result.append(item)
            seen.add(item)
    # Then add additional items not already in result
    for item in additional_items:
        if item not in seen:
            result.append(item)
            seen.add(item)
    return result


def preserve_order_union_selected_first(
    selected_items: list[str],
    base_items: list[str],
) -> list[str]:
    """
    Union two lists while preserving order from selected_items first, then appending base_items.
    This ensures selected items always appear first in the result.
    """
    seen = set()
    result = []
    # First, add selected_items in order
    for item in selected_items:
        if item not in seen:
            result.append(item)
            seen.add(item)
    # Then add base_items not already in result (preserving base order)
    for item in base_items:
        if item not in seen:
            result.append(item)
            seen.add(item)
    return result


# Inline request/response schemas
class ScenarioDetailRequest(BaseModel):
    """Request to get scenario details."""

    scenarioId: str
    # profileId removed - comes from X-Profile-Id header
    # Filter parameters (optional)
    departmentIds: list[str] | None = None
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    templateDocumentIds: list[str] | None = None
    parameterIds: list[str] | None = None
    fieldIds: list[str] | None = None  # Renamed from parameterItemIds for readability
    # Search parameters
    personaSearch: str | None = None
    documentSearch: str | None = None
    parameterSearch: str | None = None
    # Filter parameters
    documentShowSelected: bool | None = None
    documentShowTemplate: bool | None = None
    personaShowSelected: bool | None = None
    parameterShowSelected: bool | None = None
    fieldShowSelectedByParam: dict[str, bool] | None = None  # Per-parameter field filters: {paramId: bool}
    # Range parameters
    personaMin: int | None = None
    personaMax: int | None = None
    documentMin: int | None = None
    documentMax: int | None = None
    parameterSelectionMin: int | None = None
    parameterSelectionMax: int | None = None
    objectivesMin: int | None = None
    objectivesMax: int | None = None
    # Per-parameter field ranges (dict: {paramId: {"min": int, "max": int}})
    fieldRanges: dict[str, dict[str, int]] | None = (
        None  # Renamed from parameterItemRanges
    )
    # Agent filtering parameters
    useImage: bool | None = None
    useVideo: bool | None = None
    # URL parameters for linking generated resources
    imageIds: list[str] | None = None
    objectiveIds: list[str] | None = None
    problemStatementIds: list[str] | None = None
    # Text fields for current editing state (in addition to IDs for history)
    problemStatement: str | None = None
    objectives: list[str] | None = None  # JSON-encoded array from client
    name: str | None = None


class ParameterDetail(BaseModel):
    """Parameter detail structure."""

    field_ids: list[str]  # Renamed from parameter_item_ids for readability
    valid_field_ids: list[str]  # Renamed from valid_parameter_item_ids


class DocumentDetailItem(BaseModel):
    """Document detail for preview."""

    document_id: str
    name: str
    updatedAt: str
    extension: str
    scenario_ids: list[str]
    can_edit: bool
    can_delete: bool
    active: bool
    department_ids: list[str] | None
    file_path: str | None
    mime_type: str | None
    upload_id: str | None
    field_ids: list[str]  # Renamed from parameter_item_ids for readability
    is_template: bool = False  # Whether this document is a template


class ProblemStatementInfo(BaseModel):
    """Problem statement information for version history."""

    name: str = ""  # Default to empty string for backward compatibility
    problem_statement: str
    created_at: str
    updated_at: str


class ObjectiveWithDepartments(BaseModel):
    """Objective with associated department IDs."""

    objective: str
    department_ids: list[str]


class RangeMinMax(BaseModel):
    """Min/max range values."""

    min: int
    max: int


class AllowedRanges(BaseModel):
    """Allowed min/max ranges for each section."""

    persona: RangeMinMax
    document: RangeMinMax
    parameter_selection: RangeMinMax
    fields: dict[
        str, RangeMinMax
    ]  # Renamed from parameter_items - {paramId: {"min": 1, "max": 2}}


class RandomizedSelections(BaseModel):
    """Randomized selections returned from server."""

    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    parameterIds: list[str] | None = None
    fieldIds: list[str] | None = None  # Renamed from parameterItemIds


class ScenarioDetailResponse(BaseModel):
    """Detailed scenario response with all fields and metadata."""

    # Basic fields
    name: str
    description: str | None = None
    problem_statement: str
    problem_statement_id: str | None
    active: bool
    generated: bool
    parent_scenario_id: str | None
    objectives_enabled: bool
    images_enabled: bool
    video_enabled: bool
    questions_enabled: bool

    # Department
    department_ids: list[str] | None
    valid_department_ids: list[str]

    # IDs
    persona_ids: list[str]
    valid_persona_ids: list[str]
    document_ids: list[str]
    valid_document_ids: list[str]
    scenario_images: list[dict[str, Any]]
    scenario_videos: list[dict[str, Any]]
    question_ids: list[str]
    questions: list[dict[str, Any]]

    # Objectives
    objective_ids: list[str]
    valid_objectives: list[str]
    objectives_history: list[ObjectiveWithDepartments]

    # Parameters
    parameters: dict[str, ParameterDetail]

    # Simulations
    active_simulation_ids: list[str]

    # Document details
    document_details: list[DocumentDetailItem]

    # Permissions
    can_edit: bool
    can_duplicate: bool
    can_delete: bool

    # Mappings
    parameter_mapping: ParameterMapping
    field_mapping: FieldMapping
    simulation_mapping: SimulationMapping
    persona_mapping: PersonaMapping
    document_mapping: DocumentMapping
    objective_mapping: ObjectiveMapping
    department_mapping: DepartmentMapping
    problem_statement_mapping: dict[str, ProblemStatementInfo]

    # Parameter IDs
    scenario_parameter_ids: list[str]
    valid_parameter_ids: list[str]

    # Agent IDs
    scenario_agent_id: str
    image_agent_id: str
    video_agent_id: str
    agent_mapping: AgentMapping
    valid_agent_ids: list[str]
    # Filtered valid IDs (replacing client-side filtering)
    valid_field_ids: list[str] | None = (
        None  # Renamed from valid_parameter_item_ids - filtered based on departments
    )
    valid_general_field_ids: list[str] | None = (
        None  # Renamed from valid_general_parameter_item_ids - filtered based on personas/documents/parameters
    )
    # Allowed ranges (computed from filtered IDs, capped at 3)
    allowed_ranges: AllowedRanges | None = None
    # Objective count range (default: min=0, max=3)
    objective_count_range: RangeMinMax
    # Randomized selections (if randomization params provided)
    randomized_selections: RandomizedSelections | None = None
    # Flag indicating if randomization was applied (client should clear randomize param when true)
    randomized: bool = False


router = APIRouter()


# Import filtering functions from new.py (shared logic)
# For now, we'll duplicate them here to avoid circular imports
# TODO: Extract to shared utility module if needed


def filter_valid_persona_ids(
    base_ids: list[str],
    selected_dept_ids: list[str] | None,
    selected_param_ids: list[str] | None,
    selected_field_ids: list[str] | None,
    selected_persona_ids: list[str] | None,
    department_mapping: DepartmentMapping,
    persona_mapping: PersonaMapping,
    field_mapping: FieldMapping,
) -> list[str]:
    """Filter valid persona IDs based on selections."""
    if selected_dept_ids is None:
        selected_dept_ids = []
    if selected_param_ids is None:
        selected_param_ids = []
    if selected_field_ids is None:
        selected_field_ids = []
    if selected_persona_ids is None:
        selected_persona_ids = []

    selected_persona_id_set = set(selected_persona_ids)

    if len(selected_dept_ids) == 0:
        return base_ids

    all_dept_persona_ids: set[str] = set()
    for dept_data in department_mapping.values():
        if dept_data.persona_ids is not None:
            all_dept_persona_ids.update(dept_data.persona_ids)

    selected_dept_persona_ids: set[str] = set()
    for dept_id in selected_dept_ids:
        selected_dept = department_mapping.get(dept_id)
        if selected_dept is not None and selected_dept.persona_ids is not None:
            selected_dept_persona_ids.update(selected_dept.persona_ids)

    filtered = [
        pid
        for pid in base_ids
        if pid in selected_dept_persona_ids or pid not in all_dept_persona_ids
    ]

    # Maintain original order from filtered list (no special ordering for selected items)
    dept_filtered = filtered

    param_filtered = dept_filtered
    if len(selected_param_ids) > 0:
        param_filtered = [
            persona_id
            for persona_id in dept_filtered
            if persona_id in selected_persona_id_set
            or (
                persona_id in persona_mapping
                and (
                    not persona_mapping[persona_id].parameter_ids
                    or len(persona_mapping[persona_id].parameter_ids or []) == 0
                    or any(
                        param_id in (persona_mapping[persona_id].parameter_ids or [])
                        for param_id in selected_param_ids
                    )
                )
            )
        ]

    if len(selected_field_ids) == 0:
        return param_filtered

    selected_persona_id_set_for_filter = set(selected_persona_ids)

    # Build filtered result (excluding selected items)
    filtered_result = []
    selected_persona_id_set_for_result = set(selected_persona_ids)

    for persona_id in param_filtered:
        # Skip selected personas - they'll be prepended
        if persona_id in selected_persona_id_set_for_filter:
            continue

        persona = persona_mapping.get(persona_id)
        if not persona:
            filtered_result.append(persona_id)
            continue

        persona_field_ids = persona.field_ids or []
        persona_field_set = set(persona_field_ids)

        has_all_fields = True
        for selected_field_id in selected_field_ids:
            if not selected_field_id:
                continue

            selected_field = field_mapping.get(
                selected_field_id
            )  # Renamed from parameter_item_mapping
            if not selected_field or not selected_field.parameter_id:
                continue

            if selected_field_id not in persona_field_set:
                has_all_fields = False
                break

        if has_all_fields:
            filtered_result.append(persona_id)

    # Return selected items first, then filtered items
    return preserve_order_union_selected_first(selected_persona_ids, filtered_result)


def filter_valid_document_ids(
    base_ids: list[str],
    selected_dept_ids: list[str] | None,
    selected_param_ids: list[str] | None,
    selected_field_ids: list[str] | None,
    selected_doc_ids: list[str] | None,
    selected_field_ids_for_docs: list[str]
    | None,  # Renamed from selected_param_item_ids (different from selected_field_ids above)
    department_mapping: DepartmentMapping,
    document_mapping: DocumentMapping,
    field_mapping: FieldMapping,
    parameter_mapping: ParameterMapping,
    document_details: list[DocumentDetailItem],
) -> list[str]:
    """Filter valid document IDs based on selections."""
    if selected_dept_ids is None:
        selected_dept_ids = []
    if selected_param_ids is None:
        selected_param_ids = []
    if selected_field_ids is None:
        selected_field_ids = []
    if selected_doc_ids is None:
        selected_doc_ids = []
    if selected_field_ids_for_docs is None:
        selected_field_ids_for_docs = []

    selected_doc_id_set = set(selected_doc_ids)

    if len(selected_dept_ids) == 0:
        # Maintain original order from base_ids (no special ordering for selected items)
        dept_filtered_ids = base_ids
    else:
        all_dept_document_ids: set[str] = set()
        for dept_data in department_mapping.values():
            if dept_data.document_ids is not None:
                all_dept_document_ids.update(dept_data.document_ids)

        selected_dept_document_ids: set[str] = set()
        for dept_id in selected_dept_ids:
            selected_dept = department_mapping.get(dept_id)
            if selected_dept is not None and selected_dept.document_ids is not None:
                selected_dept_document_ids.update(selected_dept.document_ids)

        filtered = [
            doc_id
            for doc_id in base_ids
            if doc_id in selected_dept_document_ids
            or doc_id not in all_dept_document_ids
        ]

        # Maintain original order from filtered list (no special ordering for selected items)
        dept_filtered_ids = filtered

    current_doc_field_ids = [
        item_id
        for item_id in selected_field_ids_for_docs  # Renamed from selected_param_item_ids
        if (
            item_id in field_mapping  # Renamed from parameter_item_mapping
            and field_mapping[item_id].parameter_id in parameter_mapping
            and parameter_mapping[
                field_mapping[item_id].parameter_id
            ].document_parameter
        )
    ]

    if len(current_doc_field_ids) > 0:
        if document_details and len(document_details) > 0:
            docs_with_selected_params: set[str] = set()
            for doc in document_details:
                if doc.field_ids:  # Renamed from parameter_item_ids
                    doc_field_items_set = set(doc.field_ids)
                    has_all_selected_params = all(
                        param_id in doc_field_items_set
                        for param_id in current_doc_field_ids
                    )
                    if has_all_selected_params:
                        docs_with_selected_params.add(doc.document_id)

            if len(docs_with_selected_params) > 0:
                dept_filtered_ids = [
                    doc_id
                    for doc_id in dept_filtered_ids
                    if doc_id in docs_with_selected_params
                    or doc_id in selected_doc_id_set
                ]

    dept_filtered = dept_filtered_ids

    param_filtered = dept_filtered
    if len(selected_param_ids) > 0:
        param_filtered = [
            doc_id
            for doc_id in dept_filtered
            if doc_id in selected_doc_id_set
            or (
                doc_id in document_mapping
                and (
                    not document_mapping[doc_id].parameter_ids
                    or len(document_mapping[doc_id].parameter_ids or []) == 0
                    or any(
                        param_id in (document_mapping[doc_id].parameter_ids or [])
                        for param_id in selected_param_ids
                    )
                )
            )
        ]

    # Apply field-based filtering (bidirectional: fields → documents)
    # Filter by BOTH document parameters AND scenario parameters (back-filtering)
    # Documents can have fields from scenario parameters (e.g., Class field on documents)
    document_parameter_field_ids = []
    scenario_parameter_field_ids = []
    if selected_field_ids:
        for field_id in selected_field_ids:
            if not field_id:
                continue
            field = field_mapping.get(field_id)
            if not field or not field.parameter_id:
                continue
            param = parameter_mapping.get(field.parameter_id)
            if not param:
                continue
            # Include fields that belong to document parameters
            if param.document_parameter:
                document_parameter_field_ids.append(field_id)
            # Also include fields that belong to scenario parameters (back-filtering)
            if param.scenario_parameter:
                scenario_parameter_field_ids.append(field_id)

    # Combine both document and scenario parameter fields for filtering
    all_filtering_field_ids = (
        document_parameter_field_ids + scenario_parameter_field_ids
    )

    # Only apply field-based filtering if we have any parameter fields to filter by
    if len(all_filtering_field_ids) == 0:
        # Return param_filtered maintaining original order
        return param_filtered

    selected_doc_ids_for_filter = set(selected_doc_ids)

    # Build filtered result (excluding selected items)
    # Track if any documents match scenario parameter fields (for fallback logic)
    scenario_matches_found = False
    filtered_result = []
    for doc_id in param_filtered:
        # Skip selected documents - they'll be prepended
        if doc_id in selected_doc_ids_for_filter:
            continue

        # Get fields from documentMapping (not document_details)
        doc_mapping_item = document_mapping.get(doc_id)
        doc_field_ids: list[str] = []
        if doc_mapping_item and doc_mapping_item.field_ids:
            doc_field_ids = doc_mapping_item.field_ids

        # Get fields from document_details (field_ids)
        doc_details = next(
            (d for d in document_details if d.document_id == doc_id), None
        )
        doc_details_field_ids = (
            doc_details.field_ids
            if doc_details
            else []  # Renamed from parameter_item_ids
        )

        all_doc_field_ids = list(set(doc_field_ids + doc_details_field_ids))

        # If document has no fields at all, and we have selected parameter fields, filter it out
        if len(all_doc_field_ids) == 0 and len(all_filtering_field_ids) > 0:
            continue

        doc_field_set = set(all_doc_field_ids)

        # Separate scenario and document parameter fields for different logic
        scenario_field_ids = [
            fid
            for fid in all_filtering_field_ids
            if fid in scenario_parameter_field_ids
        ]
        document_field_ids = [
            fid
            for fid in all_filtering_field_ids
            if fid in document_parameter_field_ids
        ]

        # For scenario parameters: document must have at least ONE of the selected fields (OR logic)
        # This allows filtering when multiple fields from different parameters are selected
        has_scenario_match = False
        if len(scenario_field_ids) > 0:
            has_scenario_match = any(
                selected_field_id in doc_field_set
                for selected_field_id in scenario_field_ids
            )
            if has_scenario_match:
                scenario_matches_found = True

        # For document parameters: document must have ALL selected fields (AND logic)
        has_document_match = True
        if len(document_field_ids) > 0:
            has_document_match = all(
                selected_field_id in doc_field_set
                for selected_field_id in document_field_ids
            )

        # Document matches if it satisfies both conditions (if applicable)
        has_matching_field = (len(scenario_field_ids) == 0 or has_scenario_match) and (
            len(document_field_ids) == 0 or has_document_match
        )

        if has_matching_field:
            filtered_result.append(doc_id)

    # Fallback logic: If scenario parameter fields were selected but no documents matched,
    # show all documents instead of filtering to 0 (for better UX in back-filtering)
    if (
        len(scenario_parameter_field_ids) > 0
        and not scenario_matches_found
        and len(document_parameter_field_ids) == 0
    ):
        # No documents matched scenario fields and no document parameter fields selected
        # Return all documents (fallback behavior)
        return param_filtered

    # Return filtered result maintaining original order
    return filtered_result


def filter_valid_field_ids(  # Renamed from filter_valid_parameter_item_ids
    mapping_ids: list[str],
    selected_dept_ids: list[str] | None,
    selected_field_ids: list[str] | None,  # Renamed from selected_param_item_ids
    department_mapping: DepartmentMapping,
) -> list[str]:
    """Filter valid field IDs based on departments."""
    if selected_dept_ids is None:
        selected_dept_ids = []
    if selected_field_ids is None:
        selected_field_ids = []

    selected_field_id_set = set(selected_field_ids)

    if len(selected_dept_ids) == 0:
        return preserve_order_union_selected_first(selected_field_ids, mapping_ids)

    all_dept_field_ids: set[str] = set()
    for dept_data in department_mapping.values():
        if dept_data.field_ids is not None:  # Renamed from parameter_item_ids
            all_dept_field_ids.update(dept_data.field_ids)

    selected_dept_field_ids: set[str] = set()
    for dept_id in selected_dept_ids:
        selected_dept = department_mapping.get(dept_id)
        if (
            selected_dept is not None and selected_dept.field_ids is not None
        ):  # Renamed from parameter_item_ids
            selected_dept_field_ids.update(selected_dept.field_ids)

    filtered = [
        item_id
        for item_id in mapping_ids
        if item_id in selected_dept_field_ids or item_id not in all_dept_field_ids
    ]

    # Return filtered items in original order (no special ordering for selected items)
    return filtered


def filter_valid_general_field_ids(  # Renamed from filter_valid_general_parameter_item_ids
    valid_field_ids: list[str],  # Renamed from valid_parameter_item_ids
    selected_param_ids: list[str] | None,
    selected_persona_ids: list[str] | None,
    selected_doc_ids: list[str] | None,
    selected_field_ids: list[str] | None,  # Renamed from selected_param_item_ids
    persona_mapping: PersonaMapping,
    document_mapping: DocumentMapping,
    field_mapping: FieldMapping,
    document_details: list[DocumentDetailItem],
) -> list[str]:
    """Filter valid general field IDs based on selected personas, documents, and parameters."""
    if selected_param_ids is None:
        selected_param_ids = []
    if selected_persona_ids is None:
        selected_persona_ids = []
    if selected_doc_ids is None:
        selected_doc_ids = []
    if selected_field_ids is None:
        selected_field_ids = []

    has_selected_personas = len(selected_persona_ids) > 0
    has_selected_documents = len(selected_doc_ids) > 0
    has_selections = has_selected_personas or has_selected_documents

    persona_fields: set[str] = set()
    persona_parameter_ids: set[str] = set()
    for persona_id in selected_persona_ids:
        persona = persona_mapping.get(persona_id)
        if persona and persona.field_ids:
            for field_id in persona.field_ids:
                persona_fields.add(field_id)
                field = field_mapping.get(
                    field_id
                )  # Renamed from parameter_item_mapping
                if field and field.parameter_id:
                    persona_parameter_ids.add(field.parameter_id)

    document_fields: set[str] = set()
    document_parameter_ids: set[str] = set()
    for doc_id in selected_doc_ids:
        doc = document_mapping.get(doc_id)
        if doc and doc.field_ids:
            for field_id in doc.field_ids:
                document_fields.add(field_id)
                field = field_mapping.get(
                    field_id
                )  # Renamed from parameter_item_mapping
                if field and field.parameter_id:
                    document_parameter_ids.add(field.parameter_id)

        doc_details = next(
            (d for d in document_details if d.document_id == doc_id), None
        )
        if doc_details and doc_details.field_ids:  # Renamed from parameter_item_ids
            for field_id in doc_details.field_ids:
                document_fields.add(field_id)
                field = field_mapping.get(
                    field_id
                )  # Renamed from parameter_item_mapping
                if field and field.parameter_id:
                    document_parameter_ids.add(field.parameter_id)

    selected_entity_parameter_ids = persona_parameter_ids | document_parameter_ids

    conditional_param_ids: set[str] = set()
    for field_id in selected_field_ids:  # Renamed from selected_param_item_ids
        field = field_mapping.get(field_id)  # Renamed from parameter_item_mapping
        if field and field.conditional_parameter_ids:
            conditional_param_ids.update(field.conditional_parameter_ids)

    # Build result with selected fields first, then filtered fields
    selected_field_id_set = set(selected_field_ids)
    filtered_result = []
    for field_id in valid_field_ids:  # Renamed from valid_parameter_item_ids
        # Skip selected fields - they'll be prepended
        if field_id in selected_field_id_set:
            continue
        field = field_mapping.get(field_id)  # Renamed from parameter_item_mapping
        if not field:
            continue

        field_param_id = field.parameter_id

        if field_id == field_param_id:
            continue

        if has_selections:
            has_persona_fields = len(persona_fields) > 0
            has_document_fields = len(document_fields) > 0
            has_any_fields = has_persona_fields or has_document_fields

            if not has_any_fields:
                if len(selected_param_ids) == 0:
                    filtered_result.append(field_id)
                    continue
                if field_param_id in selected_param_ids:
                    filtered_result.append(field_id)
                continue

            if len(selected_param_ids) > 0:
                if field_param_id not in selected_param_ids:
                    if field_param_id in conditional_param_ids:
                        triggers_conditional = any(
                            selected_field_id in field_mapping
                            and field_mapping[
                                selected_field_id
                            ].conditional_parameter_ids
                            is not None
                            and field_param_id
                            in (
                                field_mapping[
                                    selected_field_id
                                ].conditional_parameter_ids
                                or []
                            )
                            and field_mapping[selected_field_id].parameter_id
                            in selected_param_ids
                            for selected_field_id in selected_field_ids
                        )
                        if triggers_conditional:
                            filtered_result.append(field_id)
                    continue

                has_fields_from_this_parameter = (
                    field_param_id in selected_entity_parameter_ids
                )

                if not has_fields_from_this_parameter:
                    filtered_result.append(field_id)
                    continue

                is_linked_to_persona = field_id in persona_fields
                is_linked_to_document = field_id in document_fields

                if is_linked_to_persona or is_linked_to_document:
                    filtered_result.append(field_id)
                continue

            has_fields_from_this_parameter = (
                field_param_id in selected_entity_parameter_ids
            )

            if not has_fields_from_this_parameter:
                filtered_result.append(field_id)
                continue

            if field_id in persona_fields:
                filtered_result.append(field_id)
                continue

            if field_id in document_fields:
                filtered_result.append(field_id)
                continue

            if field_param_id in conditional_param_ids:
                filtered_result.append(field_id)
                continue

            continue

        if len(selected_param_ids) == 0:
            filtered_result.append(field_id)
            continue

        if field_param_id in selected_param_ids:
            filtered_result.append(field_id)
            continue

        if field_param_id in conditional_param_ids:
            filtered_result.append(field_id)
            continue

    # Return filtered fields in original order (no special ordering for selected items)
    return filtered_result


@router.post(
    "/detail",
    response_model=ScenarioDetailResponse,
    dependencies=[
        audit_activity(
            "scenario.viewed", "{{ actor.name }} viewed scenario '{{ scenario.name }}'"
        )
    ],
)
async def get_scenario_detail(
    request_data: ScenarioDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioDetailResponse:
    """Get detailed scenario information."""
    tags = ["scenarios"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ScenarioDetailResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert documentIds to UUID array if provided
        document_ids_uuid = None
        if request_data.documentIds:
            try:
                document_ids_uuid = [
                    uuid.UUID(did) for did in request_data.documentIds
                ]
            except (ValueError, TypeError):
                document_ids_uuid = None

        # Convert templateDocumentIds to UUID array if provided
        template_document_ids_uuid = None
        if request_data.templateDocumentIds:
            try:
                template_document_ids_uuid = [
                    uuid.UUID(did) for did in request_data.templateDocumentIds
                ]
            except (ValueError, TypeError):
                template_document_ids_uuid = None

        # Convert problemStatementIds to UUID array if provided
        problem_statement_ids_uuid = None
        if request_data.problemStatementIds:
            try:
                problem_statement_ids_uuid = [
                    uuid.UUID(psid) for psid in request_data.problemStatementIds
                ]
            except (ValueError, TypeError):
                problem_statement_ids_uuid = None

        # Derive useObjectives from objectivesMax for backward compatibility with SQL
        use_objectives = (
            request_data.objectivesMax is not None and request_data.objectivesMax > 0
        )

        # Convert API request to SQL params (add profile_id from header)
        params = GetScenarioDetailSqlParams(
            scenario_id=uuid.UUID(request_data.scenarioId),
            profile_id=profile_id,
            use_image=request_data.useImage if request_data.useImage is not None else False,
            use_objectives=use_objectives,
            document_ids=document_ids_uuid,
            problem_statement_ids=problem_statement_ids_uuid,
            template_document_ids=template_document_ids_uuid,
            use_video=request_data.useVideo if request_data.useVideo is not None else False,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetScenarioDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if scenario exists and has access using SQL result
        if not result.scenario_exists:
            raise HTTPException(
                status_code=404, detail=f"Scenario {request_data.scenarioId} not found"
            )
        
        if not result.scenario_id:
            # Scenario exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this scenario. It may be restricted to other departments.",
            )

        # Convert arrays from SQL result to mappings for filtering functions (temporary - will update to use arrays in Task 4)
        
        # Get persona_ids from query result
        persona_ids = [str(pid) for pid in (result.persona_ids or []) if pid]

        # Convert arrays to mappings for filtering functions
        def to_str_list(value: list[Any] | None) -> list[str] | None:
            if value is None:
                return None
            return [str(v) for v in value if v is not None]

        # Convert personas array to mapping
        persona_mapping: PersonaMapping = {}
        for persona in (result.personas or []):
            if persona.persona_id:
                persona_mapping[str(persona.persona_id)] = PersonaMappingItem(
                    name=persona.name or "",
                    description=persona.description or "",
                    color=persona.color or "",
                    icon=persona.icon or "",
                    image_model=persona.image_model or False,
                    parameter_ids=to_str_list(persona.parameter_ids),
                    field_ids=to_str_list(persona.field_ids),
                    example=persona.example,
                )

        # Convert documents array to mapping
        document_mapping: DocumentMapping = {}
        for doc in (result.documents or []):
            if doc.document_id:
                document_mapping[str(doc.document_id)] = DocumentMappingItem(
                    name=doc.name or "",
                    description=doc.description or "",
                    filePath=doc.file_path,
                    mimeType=doc.mime_type,
                    parameter_ids=to_str_list(doc.parameter_ids),
                    field_ids=to_str_list(doc.field_ids),
                    parent_document_id=str(doc.parent_document_id) if doc.parent_document_id else None,
                )

        # Convert parameters array to mapping
        parameter_mapping: ParameterMapping = {}
        for param in (result.parameters or []):
            if param.parameter_id:
                parameter_mapping[str(param.parameter_id)] = ParameterMappingItem(
                    name=param.name or "",
                    description=param.description or "",
                    numerical=False,  # Not in composite type, default to False
                    document_parameter=param.document_parameter or False,
                    persona_parameter=param.persona_parameter or False,
                    scenario_parameter=param.scenario_parameter or False,
                    video_parameter=param.video_parameter or False,
                )

        # Convert fields array to mapping
        field_mapping: FieldMapping = {}
        for field in (result.fields or []):
            if field.field_id:
                field_mapping[str(field.field_id)] = FieldMappingItem(
                    name=field.name or "",
                    description=field.description or "",
                    parameter_id=str(field.parameter_id) if field.parameter_id else "",
                    parameter_name=field.parameter_name or "",
                    conditional_parameter_ids=to_str_list(field.conditional_parameter_ids),
                )

        # Convert departments array to mapping
        department_mapping: DepartmentMapping = {}
        for dept in (result.departments or []):
            if dept.department_id:
                department_mapping[str(dept.department_id)] = DepartmentMappingItem(
                    name=dept.name or "",
                    description=dept.description or "",
                    persona_ids=to_str_list(dept.persona_ids),
                    document_ids=to_str_list(dept.document_ids),
                    parameter_ids=to_str_list(dept.parameter_ids),
                    parameter_item_ids=to_str_list(dept.field_ids),  # field_ids in composite type
                )

        # Convert agents array to mapping
        agent_mapping: AgentMapping = {}
        for agent in (result.agents or []):
            if agent.agent_id:
                agent_mapping[str(agent.agent_id)] = AgentMappingItem(
                    name=agent.name or "",
                    description=agent.description or "",
                    roles=[str(r) for r in (agent.roles or [])],
                )

        # Convert simulations array to mapping
        simulation_mapping: SimulationMapping = {}
        for sim in (result.simulations or []):
            if sim.simulation_id:
                simulation_mapping[str(sim.simulation_id)] = SimulationMappingItem(
                    name=sim.name or "",
                    description=sim.description or "",
                    time_limit=sim.time_limit,
                    department_ids=to_str_list(sim.department_ids),
                )

        # Convert objectives array to mapping
        objective_mapping: ObjectiveMapping = {}
        for obj in (result.objectives or []):
            if obj.objective_id:
                objective_mapping[str(obj.objective_id)] = ObjectiveMappingItem(
                    name=obj.name or "",
                    description=obj.description or "",
                )

        # Convert problem statements array to mapping
        problem_statement_mapping: dict[str, ProblemStatementInfo] = {}
        for ps in (result.problem_statements or []):
            if ps.problem_statement_id:
                problem_statement_mapping[str(ps.problem_statement_id)] = ProblemStatementInfo(
                    name=ps.name or "",
                    problem_statement=ps.problem_statement or "",
                    created_at=str(ps.created_at) if ps.created_at else "",
                    updated_at=str(ps.updated_at) if ps.updated_at else "",
                )

        # Convert objectives_history array
        objectives_history: list[ObjectiveWithDepartments] = []
        for obj in (result.objectives_history or []):
            objectives_history.append(
                ObjectiveWithDepartments(
                    objective=obj.objective or "",
                    department_ids=[str(did) for did in (obj.department_ids or []) if did],
                )
            )

        # Convert document_details array
        document_details: list[DocumentDetailItem] = []
        for doc in (result.document_details or []):
            document_details.append(
                DocumentDetailItem(
                    document_id=str(doc.document_id) if doc.document_id else "",
                    name=doc.name or "",
                    updatedAt=str(doc.updated_at) if doc.updated_at else "",
                    extension="",  # Not in composite type
                    scenario_ids=[],  # Not in composite type
                    can_edit=doc.can_edit or True,
                    can_delete=doc.can_delete or True,
                    active=doc.active or True,
                    department_ids=to_str_list(doc.department_ids),
                    file_path=doc.file_path,
                    mime_type=doc.mime_type,
                    upload_id=str(doc.upload_id) if doc.upload_id else None,
                    field_ids=[str(fid) for fid in (doc.field_ids or []) if fid],
                    is_template=doc.is_template or False,
                )
            )

        # Convert parameters_detail array to parameters_dict
        parameters_dict: dict[str, ParameterDetail] = {}
        for param_detail in (result.parameters_detail or []):
            if param_detail.param_id:
                parameters_dict[str(param_detail.param_id)] = ParameterDetail(
                    field_ids=[str(fid) for fid in (param_detail.selected_items or []) if fid],
                    valid_field_ids=[str(fid) for fid in (param_detail.valid_items or []) if fid],
                )

        # Convert scenario_images array
        scenario_images: list[dict[str, Any]] = []
        for img in (result.scenario_images or []):
            scenario_images.append({
                "id": str(img.upload_id) if img.upload_id else "",
                "name": img.name or "",
                "upload_id": str(img.upload_id) if img.upload_id else "",
                "file_path": img.file_path or "",
                "mime_type": img.mime_type or "",
                "active": img.active or True,
            })

        # Convert scenario_videos array
        scenario_videos: list[dict[str, Any]] = []
        for vid in (result.scenario_videos or []):
            scenario_videos.append({
                "id": str(vid.id) if vid.id else "",
                "name": vid.name or "",
                "length_seconds": vid.length_seconds or 0,
                "completed": vid.completed or False,
                "active": vid.active or True,
                "image_enabled": vid.image_enabled or False,
                "file_path": vid.file_path,
                "mime_type": vid.mime_type,
                "upload_id": str(vid.upload_id) if vid.upload_id else None,
            })

        # Convert questions array
        questions: list[dict[str, Any]] = []
        for q in (result.questions or []):
            questions.append({
                "id": str(q.id) if q.id else "",
                "question_text": q.question_text or "",
                "allow_multiple": q.allow_multiple or False,
                "active": q.active or True,
                "options": [
                    {
                        "id": str(opt.id) if opt.id else "",
                        "option_text": opt.option_text or "",
                        "type": opt.type or "",
                        "is_correct": opt.is_correct or False,
                    }
                    for opt in (q.options or [])
                ],
                "times": q.times or [],
            })

        # Get other fields from result
        document_ids = [str(did) for did in (result.document_ids or []) if did]
        objective_ids = [str(oid) for oid in (result.objective_ids or []) if oid]
        active_simulation_ids = [str(sid) for sid in (result.simulation_ids or []) if sid]
        valid_persona_ids = [str(pid) for pid in (result.valid_persona_ids or []) if pid]
        valid_document_ids = [str(did) for did in (result.valid_document_ids or []) if did]
        dept_ids = [str(did) for did in (result.valid_department_ids or []) if did]
        valid_agent_ids = [str(aid) for aid in (result.valid_agent_ids or []) if aid]
        scenario_parameter_ids = [str(pid) for pid in (result.parameter_ids or []) if pid]
        department_ids = [str(did) for did in (result.department_ids or []) if did]

        # Compute permissions
        in_use_by_active = (result.active_usage_count or 0) > 0
        is_generated = result.generated or False
        is_superadmin = (result.user_role or "") == "superadmin"
        has_department_links = len(department_ids) > 0
        is_default = not has_department_links

        # Scenarios are immutable once in use (exception to general rule)
        # Also check if default object and user is not superadmin
        can_edit = (
            not in_use_by_active
            and not is_generated
            and not (is_default and not is_superadmin)
        )
        can_duplicate = True
        # Can't delete if can't edit (stricter than can_edit)
        can_delete = can_edit and not in_use_by_active and is_superadmin

        # valid_parameter_ids are all keys in parameter_mapping
        valid_parameter_ids = list(parameter_mapping.keys())

        # Reorder valid_parameter_ids to put selected parameters first
        if request_data.parameterIds:
            selected_param_set = set(request_data.parameterIds)
            selected_params = [
                pid for pid in request_data.parameterIds if pid in valid_parameter_ids
            ]
            other_params = [
                pid for pid in valid_parameter_ids if pid not in selected_param_set
            ]
            valid_parameter_ids = selected_params + other_params

        # Get field ranges from result
        field_ranges_from_db: dict[str, dict[str, int]] = {}
        for fr in (result.field_ranges or []):
            if fr.parameter_id:
                field_ranges_from_db[str(fr.parameter_id)] = {
                    "min": fr.min_count or 1,
                    "max": fr.max_count or 1,
                }

        # Apply filtering based on request parameters
        filtered_valid_persona_ids = valid_persona_ids
        filtered_valid_document_ids = valid_document_ids
        filtered_valid_field_ids: list[str] | None = (
            None  # Renamed from filtered_valid_parameter_item_ids
        )
        filtered_valid_general_field_ids: list[str] | None = (
            None  # Renamed from filtered_valid_general_parameter_item_ids
        )
        allowed_ranges: AllowedRanges | None = None
        randomized_selections: RandomizedSelections | None = None

        needs_filtering = (
            request_data.departmentIds is not None
            or request_data.personaIds is not None
            or request_data.documentIds is not None
            or request_data.parameterIds is not None
            or request_data.fieldIds is not None
        )

        # Only apply filtering if filter parameters are provided or randomize is present
        if needs_filtering:
            # Filter valid persona IDs
            filtered_valid_persona_ids = filter_valid_persona_ids(
                base_ids=valid_persona_ids,
                selected_dept_ids=request_data.departmentIds,
                selected_param_ids=request_data.parameterIds,
                selected_field_ids=request_data.fieldIds,  # Renamed from parameterItemIds
                selected_persona_ids=request_data.personaIds,
                department_mapping=department_mapping,
                persona_mapping=persona_mapping,
                field_mapping=field_mapping,  # Renamed from param_item_full_mapping
            )

            # Filter valid document IDs
            filtered_valid_document_ids = filter_valid_document_ids(
                base_ids=valid_document_ids,
                selected_dept_ids=request_data.departmentIds,
                selected_param_ids=request_data.parameterIds,
                selected_field_ids=request_data.fieldIds,  # Renamed from parameterItemIds
                selected_doc_ids=request_data.documentIds,
                selected_field_ids_for_docs=request_data.fieldIds,  # Renamed from parameterItemIds
                department_mapping=department_mapping,
                document_mapping=document_mapping,
                field_mapping=field_mapping,  # Renamed from param_item_full_mapping
                parameter_mapping=parameter_mapping,
                document_details=document_details,
            )

            # Filter valid field IDs
            mapping_ids = list(
                field_mapping.keys()
            )  # Renamed from param_item_full_mapping
            filtered_valid_field_ids = filter_valid_field_ids(  # Renamed from filter_valid_parameter_item_ids
                mapping_ids=mapping_ids,
                selected_dept_ids=request_data.departmentIds,
                selected_field_ids=request_data.fieldIds,  # Renamed from parameterItemIds
                department_mapping=department_mapping,
            )

            # Filter valid general field IDs
            filtered_valid_general_field_ids = filter_valid_general_field_ids(  # Renamed from filter_valid_general_parameter_item_ids
                valid_field_ids=filtered_valid_field_ids,  # Renamed from valid_parameter_item_ids
                selected_param_ids=request_data.parameterIds,
                selected_persona_ids=request_data.personaIds,
                selected_doc_ids=request_data.documentIds,
                selected_field_ids=request_data.fieldIds,  # Renamed from parameterItemIds
                persona_mapping=persona_mapping,
                document_mapping=document_mapping,
                field_mapping=field_mapping,  # Renamed from param_item_full_mapping
                document_details=document_details,
            )

        # Read ranges from database (scenario-specific) or use defaults
        # Personas: read from scenario_persona_ranges or use defaults (1-3)
        allowed_persona_min = result.persona_range_min or 1
        allowed_persona_max = result.persona_range_max or 3
        persona_min = (
            request_data.personaMin
            if request_data.personaMin is not None
            else allowed_persona_min
        )
        persona_max = (
            request_data.personaMax
            if request_data.personaMax is not None
            else allowed_persona_min
        )
        # Ensure requested values are within allowed range
        persona_min = max(allowed_persona_min, min(persona_min, allowed_persona_max))
        persona_max = max(allowed_persona_min, min(persona_max, allowed_persona_max))
        # Ensure min doesn't exceed max
        persona_min = min(persona_min, persona_max)

        # Documents: read from scenario_document_ranges or use defaults (0-3)
        allowed_document_min = result.document_range_min or 0
        allowed_document_max = result.document_range_max or 3
        document_min = (
            request_data.documentMin
            if request_data.documentMin is not None
            else allowed_document_min
        )
        document_max = (
            request_data.documentMax
            if request_data.documentMax is not None
            else allowed_document_min
        )
        # Ensure requested values are within allowed range
        document_min = max(
            allowed_document_min, min(document_min, allowed_document_max)
        )
        document_max = max(
            allowed_document_min, min(document_max, allowed_document_max)
        )
        # Ensure min doesn't exceed max
        document_min = min(document_min, document_max)

        # Parameters: read from scenario_parameter_ranges or use defaults (0-3)
        allowed_parameter_min = result.parameter_range_min or 0
        allowed_parameter_max = result.parameter_range_max or 3
        parameter_selection_min = (
            request_data.parameterSelectionMin
            if request_data.parameterSelectionMin is not None
            else allowed_parameter_min
        )
        parameter_selection_max = (
            request_data.parameterSelectionMax
            if request_data.parameterSelectionMax is not None
            else allowed_parameter_max
        )
        # Ensure requested values are within allowed range
        parameter_selection_min = max(
            allowed_parameter_min, min(parameter_selection_min, allowed_parameter_max)
        )
        parameter_selection_max = max(
            allowed_parameter_min, min(parameter_selection_max, allowed_parameter_max)
        )
        # Ensure min doesn't exceed max
        parameter_selection_min = min(parameter_selection_min, parameter_selection_max)

        # Per-parameter field ranges
        # Read from database (scenario_field_ranges) or use defaults
        field_ranges_dict: dict[str, dict[str, int]] = {}
        allowed_field_ranges: dict[str, RangeMinMax] = {}

        for param_id in parameter_mapping.keys():
            # Get range from request, database, or use defaults
            if request_data.fieldRanges and param_id in request_data.fieldRanges:
                # Use request value
                param_range = request_data.fieldRanges[param_id]
                param_min = param_range.get("min", 1)
                param_max = param_range.get("max", 1)
            elif param_id in field_ranges_from_db:
                # Use database value
                db_range = field_ranges_from_db[param_id]
                param_min = db_range.get("min", 1)
                param_max = db_range.get("max", 1)
            else:
                # Use defaults
                param_min = 1
                param_max = 1

            # Ensure max doesn't exceed fixed limit
            param_max = min(param_max, 3)
            # Ensure min doesn't exceed max
            param_min = min(param_min, param_max)

            field_ranges_dict[param_id] = {
                "min": param_min,
                "max": param_max,
            }

            # Allowed range for this parameter (from database or default)
            if param_id in field_ranges_from_db:
                db_range = field_ranges_from_db[param_id]
                allowed_field_ranges[param_id] = RangeMinMax(
                    min=max(1, min(db_range.get("min", 1), 3)),
                    max=max(1, min(db_range.get("max", 3), 3)),
                )
            else:
                allowed_field_ranges[param_id] = RangeMinMax(min=1, max=3)

        # Allowed ranges from database (scenario-specific) or defaults
        allowed_ranges = AllowedRanges(
            persona=RangeMinMax(min=allowed_persona_min, max=allowed_persona_max),
            document=RangeMinMax(min=allowed_document_min, max=allowed_document_max),
            parameter_selection=RangeMinMax(
                min=allowed_parameter_min, max=allowed_parameter_max
            ),
            fields=allowed_field_ranges,
        )

        # No randomization - set to None/False for backward compatibility
        randomized_selections: RandomizedSelections | None = None
        randomization_occurred = False

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                request,
                actor={"name": result.actor_name, "id": profile_id},
                scenario={"name": result.name or "", "id": request_data.scenarioId},
            )

        # Use existing scenario values (no randomization in REST endpoint)
        final_persona_ids = persona_ids
        final_document_ids = document_ids
        final_parameter_ids = scenario_parameter_ids
        # Fields come from parameters dict (existing scenario data)
        final_field_ids = None

        # Apply search filtering if search terms provided
        if request_data.personaSearch:
            search_lower = request_data.personaSearch.lower()
            filtered_valid_persona_ids = [
                pid
                for pid in filtered_valid_persona_ids
                if pid in persona_mapping
                and (
                    search_lower in persona_mapping[pid].name.lower()
                    or (
                        persona_mapping[pid].description
                        and search_lower in persona_mapping[pid].description.lower()
                    )
                )
            ]

        # Track selected personas to always include them (even when filtered out)
        selected_persona_ids_set = set(request_data.personaIds or [])
        
        # Apply showSelected filter (server-side)
        if request_data.personaShowSelected:
            filtered_valid_persona_ids = [
                pid for pid in filtered_valid_persona_ids
                if pid in selected_persona_ids_set
            ]
        
        # Always include selected personas in valid_persona_ids (even if filtered out)
        # This ensures selected personas remain visible and don't get cleared by client-side cleanup
        for selected_persona_id in selected_persona_ids_set:
            if selected_persona_id not in filtered_valid_persona_ids:
                # Check if the persona exists in persona_mapping (is actually valid)
                if selected_persona_id in persona_mapping:
                    filtered_valid_persona_ids.append(selected_persona_id)

        if request_data.documentSearch:
            search_lower = request_data.documentSearch.lower()
            filtered_valid_document_ids = [
                did
                for did in filtered_valid_document_ids
                if did in document_mapping
                and (
                    search_lower in document_mapping[did].name.lower()
                    or (
                        document_mapping[did].description
                        and search_lower in document_mapping[did].description.lower()
                    )
                )
            ]

        # Track selected documents to always include them (even when filtered out)
        selected_doc_ids_set = set(request_data.documentIds or [])
        
        # Apply showSelected filter (server-side)
        if request_data.documentShowSelected:
            filtered_valid_document_ids = [
                did for did in filtered_valid_document_ids
                if did in selected_doc_ids_set
            ]

        # Apply showTemplate filter (server-side)
        if request_data.documentShowTemplate:
            # Build set of template document IDs from document_details
            template_doc_ids_set = set()
            for doc_detail in document_details:
                if doc_detail.is_template:
                    template_doc_ids_set.add(doc_detail.document_id)
            # Also include documents in templateDocumentIds
            if request_data.templateDocumentIds:
                template_doc_ids_set.update(request_data.templateDocumentIds)

            filtered_valid_document_ids = [
                did for did in filtered_valid_document_ids
                if did in template_doc_ids_set
            ]
        
        # Always include selected documents in valid_document_ids (even if filtered out)
        # This ensures selected documents remain visible and don't get cleared by client-side cleanup
        for selected_doc_id in selected_doc_ids_set:
            if selected_doc_id not in filtered_valid_document_ids:
                # Check if the document exists in document_mapping (is actually valid)
                if selected_doc_id in document_mapping:
                    filtered_valid_document_ids.append(selected_doc_id)

        # Apply parameter filtering
        if request_data.parameterSearch:
            search_lower = request_data.parameterSearch.lower()
            valid_parameter_ids = [
                pid
                for pid in valid_parameter_ids
                if pid in parameter_mapping
                and (
                    search_lower in parameter_mapping[pid].name.lower()
                    or (
                        parameter_mapping[pid].description
                        and search_lower in parameter_mapping[pid].description.lower()
                    )
                )
            ]

        # Track selected parameters to always include them (even when filtered out)
        selected_param_ids_set = set(request_data.parameterIds or [])
        
        # Apply showSelected filter for parameters (server-side)
        if request_data.parameterShowSelected:
            valid_parameter_ids = [
                pid for pid in valid_parameter_ids
                if pid in selected_param_ids_set
            ]
        
        # Always include selected parameters in valid_parameter_ids (even if filtered out)
        for selected_param_id in selected_param_ids_set:
            if selected_param_id not in valid_parameter_ids:
                # Check if the parameter exists in parameter_mapping (is actually valid)
                if selected_param_id in parameter_mapping:
                    valid_parameter_ids.append(selected_param_id)

        # Apply per-parameter field filtering (after filtered_valid_general_field_ids is computed)
        # Each parameter's field section can have its own "show selected" filter
        if filtered_valid_general_field_ids is not None and request_data.fieldShowSelectedByParam:
            # Track selected fields to always include them (even when filtered out)
            selected_field_ids_set = set(request_data.fieldIds or [])
            
            # Get all valid field IDs for parameters that have showSelected=False
            # When showSelected is False, we need to show ALL fields (including selected ones)
            # filtered_valid_general_field_ids excludes selected fields, so we need to get all fields from field_mapping
            all_valid_field_ids = list(field_mapping.keys())
            
            # Apply per-parameter filtering: if a parameter has showSelected=true, filter its fields
            filtered_result = []
            processed_field_ids = set()
            
            for field_id in filtered_valid_general_field_ids:
                field = field_mapping.get(field_id)
                if not field or not field.parameter_id:
                    # Include fields without parameter_id
                    filtered_result.append(field_id)
                    processed_field_ids.add(field_id)
                    continue
                
                param_id = field.parameter_id
                # If this parameter has showSelected filter active, only include selected fields for this parameter
                if request_data.fieldShowSelectedByParam.get(param_id, False):
                    if field_id in selected_field_ids_set:
                        filtered_result.append(field_id)
                        processed_field_ids.add(field_id)
                else:
                    # No filter for this parameter, include all fields (both selected and unselected)
                    # Add unselected fields from filtered_valid_general_field_ids
                    filtered_result.append(field_id)
                    processed_field_ids.add(field_id)
                    # Also add selected fields for this parameter that weren't in filtered_valid_general_field_ids
                    for selected_field_id in selected_field_ids_set:
                        if selected_field_id not in processed_field_ids:
                            selected_field = field_mapping.get(selected_field_id)
                            if selected_field and selected_field.parameter_id == param_id:
                                filtered_result.append(selected_field_id)
                                processed_field_ids.add(selected_field_id)
            
            filtered_valid_general_field_ids = filtered_result
            
            # Always include any remaining selected fields that weren't processed (for parameters not in fieldShowSelectedByParam)
            for selected_field_id in selected_field_ids_set:
                if selected_field_id not in processed_field_ids:
                    # Check if the field exists in field_mapping (is actually valid)
                    if selected_field_id in field_mapping:
                        filtered_valid_general_field_ids.append(selected_field_id)

        response_data = ScenarioDetailResponse(
            name=result.name or "",
            description=result.description,
            problem_statement=result.problem_statement or "",
            problem_statement_id=result.problem_statement_id,
            active=result.active or False,
            generated=is_generated,
            objectives_enabled=result.objectives_enabled or True,
            images_enabled=result.image_input_enabled or False,
            parent_scenario_id=result.parent_scenario_id,
            department_ids=department_ids,
            valid_department_ids=dept_ids,
            persona_ids=final_persona_ids,
            valid_persona_ids=filtered_valid_persona_ids,
            document_ids=final_document_ids,
            valid_document_ids=filtered_valid_document_ids,
            valid_field_ids=filtered_valid_field_ids,  # Renamed from valid_parameter_item_ids
            valid_general_field_ids=filtered_valid_general_field_ids,  # Renamed from valid_general_parameter_item_ids
            allowed_ranges=allowed_ranges,
            # Objectives: 0-3 (default: 1) - fixed range
            objective_count_range=RangeMinMax(min=1, max=3),
            randomized_selections=randomized_selections,
            randomized=randomization_occurred,
            scenario_images=scenario_images,
            objective_ids=objective_ids,
            valid_objectives=[],
            objectives_history=objectives_history,
            parameters=parameters_dict,
            active_simulation_ids=active_simulation_ids,
            document_details=document_details,
            can_edit=can_edit,
            can_duplicate=can_duplicate,
            can_delete=can_delete,
            parameter_mapping=parameter_mapping,
            field_mapping=field_mapping,  # Renamed from parameter_item_mapping
            simulation_mapping=simulation_mapping,
            persona_mapping=persona_mapping,
            document_mapping=document_mapping,
            objective_mapping=objective_mapping,
            department_mapping=department_mapping,
            problem_statement_mapping=problem_statement_mapping,
            scenario_parameter_ids=final_parameter_ids,
            valid_parameter_ids=valid_parameter_ids,
            scenario_agent_id=result.scenario_agent_id or "",
            image_agent_id=result.image_agent_id or "",
            video_agent_id=result.video_agent_id or "",
            video_enabled=result.video_enabled or False,
            questions_enabled=result.questions_enabled or False,
            scenario_videos=scenario_videos,
            question_ids=[str(q.id) for q in (result.questions or []) if q.id],
            questions=questions,
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode='json')},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_scenario_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
