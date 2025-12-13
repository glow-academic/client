"""Video detail endpoint - v3 API following DHH principles."""

import json
from collections.abc import Sequence
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


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
AgentMapping = dict[str, AgentMappingItem]


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
class VideoDetailRequest(BaseModel):
    """Request to get video detail."""

    videoId: str
    profileId: str
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
    # Range parameters
    personaMin: int | None = None
    personaMax: int | None = None
    documentMin: int | None = None
    documentMax: int | None = None
    parameterSelectionMin: int | None = None
    parameterSelectionMax: int | None = None
    questionsMin: int | None = None
    questionsMax: int | None = None
    # Per-parameter field ranges (dict: {paramId: {"min": int, "max": int}})
    fieldRanges: dict[str, dict[str, int]] | None = None
    # Randomization parameter (single param: "all", "persona", "document", "parameters", or "parameter_{field_id}")
    randomize: str | None = None


class QuestionOptionResponse(BaseModel):
    """Option in question response."""

    option_id: str
    option_text: str
    type: str  # 'discrete' or 'freeform'
    is_correct: bool


class QuestionResponse(BaseModel):
    """Question in video detail response."""

    question_id: str
    question_text: str
    allow_multiple: bool
    times: list[int]  # Array of seconds when question appears
    options: list[QuestionOptionResponse]


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


class RangeMinMax(BaseModel):
    """Min/max range values."""

    min: int
    max: int


class AllowedRanges(BaseModel):
    """Allowed min/max ranges for each section."""

    persona: RangeMinMax
    document: RangeMinMax
    parameter_selection: RangeMinMax
    fields: dict[str, RangeMinMax]  # {paramId: {"min": 1, "max": 2}}


class RandomizedSelections(BaseModel):
    """Randomized selections returned from server."""

    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    parameterIds: list[str] | None = None
    fieldIds: list[str] | None = None  # Renamed from parameterItemIds


class VideoDetailResponse(BaseModel):
    """Response for video detail."""

    name: str
    length_seconds: int
    active: bool
    upload_id: str | None
    video_url: str | None
    department_ids: list[str] | None
    valid_department_ids: list[str]
    outline_ids: list[str]
    outline_mapping: dict[str, dict[str, str]]
    document_ids: list[str]
    document_mapping: dict[str, dict[str, Any]]
    document_details: list[DocumentDetailItem]
    valid_document_ids: list[str]
    video_images: list[dict[str, Any]]
    objectives_history: list[str]
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    department_mapping: DepartmentMapping
    questions: list[QuestionResponse]
    outline_agent_id: str
    image_agent_id: str
    video_agent_id: str
    agent_mapping: AgentMapping
    valid_agent_ids: list[str]
    parameter_mapping: ParameterMapping
    field_mapping: FieldMapping
    parameter_item_ids: list[str]
    video_parameter_ids: list[str]
    valid_parameter_ids: list[str]
    persona_ids: list[str]
    persona_mapping: PersonaMapping
    valid_persona_ids: list[str]
    # Filtered valid IDs (replacing client-side filtering)
    valid_field_ids: list[str] | None = None  # Filtered based on departments
    valid_general_field_ids: list[str] | None = (
        None  # Filtered based on personas/documents/parameters
    )
    # Allowed ranges (computed from filtered IDs, capped at 3)
    allowed_ranges: AllowedRanges | None = None
    # Question count range (computed from video length)
    question_count_range: RangeMinMax
    # Randomized selections (if randomization params provided)
    randomized_selections: RandomizedSelections | None = None
    # Flag indicating if randomization was applied (client should clear randomize param when true)
    randomized: bool = False
    # Selected IDs from request (filtered to valid ones) - server-driven approach
    selected_persona_ids: list[str] | None = None
    selected_document_ids: list[str] | None = None
    selected_template_document_ids: list[str] | None = None
    selected_parameter_ids: list[str] | None = None
    selected_field_ids: list[str] | None = None
    # Search terms from request
    persona_search: str | None = None
    document_search: str | None = None
    parameter_search: str | None = None
    # Range values from request
    persona_min: int | None = None
    persona_max: int | None = None
    document_min: int | None = None
    document_max: int | None = None
    parameter_selection_min: int | None = None
    parameter_selection_max: int | None = None
    field_ranges: dict[str, dict[str, int]] | None = None


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
        return preserve_order_union_selected_first(selected_persona_ids, base_ids)

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

    dept_filtered = preserve_order_union_selected_first(selected_persona_ids, filtered)

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
    filtered_result = []

    for persona_id in param_filtered:
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

            selected_field = field_mapping.get(selected_field_id)
            if not selected_field or not selected_field.parameter_id:
                continue

            if selected_field_id not in persona_field_set:
                has_all_fields = False
                break

        if has_all_fields:
            filtered_result.append(persona_id)

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
    """
    Filter valid document IDs based on selections.
    Replicates logic from client-side useMemo (lines 759-937 of Scenario.tsx).
    """
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

    # Always include currently selected documents (for edit mode - ensures selected items are visible)
    selected_doc_id_set = set(selected_doc_ids)

    # If no departments selected, start with selected ones first, then all valid IDs (preserving order)
    if len(selected_dept_ids) == 0:
        dept_filtered_ids = preserve_order_union_selected_first(
            selected_doc_ids, base_ids
        )
    else:
        # Get union of document_ids from ALL departments (to identify cross-department items)
        all_dept_document_ids: set[str] = set()
        for dept_data in department_mapping.values():
            if dept_data.document_ids:
                all_dept_document_ids.update(dept_data.document_ids)

        # Get union of document_ids from selected departments
        selected_dept_document_ids: set[str] = set()
        for dept_id in selected_dept_ids:
            selected_dept = department_mapping.get(dept_id)
            if selected_dept is not None and selected_dept.document_ids is not None:
                selected_dept_document_ids.update(selected_dept.document_ids)

        # Include items that are:
        # 1. In selected departments
        # 2. Cross-department (not in any department's document_ids)
        # 3. Currently selected
        filtered = [
            doc_id
            for doc_id in base_ids
            if doc_id in selected_dept_document_ids
            or doc_id not in all_dept_document_ids
        ]

        # Preserve order: selected items first, then filtered items
        dept_filtered_ids = preserve_order_union_selected_first(
            selected_doc_ids, filtered
        )

    # Filter by selected document fields if any are selected
    # Compute documentFieldIds inline to avoid dependency order issue
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
        # If document_details is empty/missing, can't filter - show all documents
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

            # If documents match document parameter filtering, apply it
            if len(docs_with_selected_params) > 0:
                dept_filtered_ids = [
                    doc_id
                    for doc_id in dept_filtered_ids
                    if doc_id in docs_with_selected_params
                    or doc_id in selected_doc_id_set
                ]
        # If no documents match, continue to field-based filtering (don't filter out everything)

    dept_filtered = dept_filtered_ids

    # Apply parameter-based filtering
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
        return preserve_order_union_selected_first(selected_doc_ids, param_filtered)

    # Always include currently selected documents (for edit mode)
    selected_doc_ids_for_filter = set(selected_doc_ids)

    result = []
    # Track if any documents match scenario parameter fields (for fallback logic)
    scenario_matches_found = False
    for doc_id in param_filtered:
        # Always include currently selected documents
        if doc_id in selected_doc_ids_for_filter:
            result.append(doc_id)
            continue

        # Get fields from documentMapping (not document_details)
        doc_item: DocumentMappingItem | None = document_mapping.get(doc_id)
        doc_field_ids: list[str] = []
        if doc_item and doc_item.field_ids:
            doc_field_ids = doc_item.field_ids

        # Get fields from document_details (field_ids)
        doc_details: DocumentDetailItem | None = next(
            (d for d in document_details if d.document_id == doc_id), None
        )
        doc_details_field_ids = (
            doc_details.field_ids
            if doc_details
            else []  # Renamed from parameter_item_ids
        )

        # Combine both sources of field IDs
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
            result.append(doc_id)

    # Fallback logic: If scenario parameter fields were selected but no documents matched,
    # show all documents instead of filtering to 0 (for better UX in back-filtering)
    if (
        len(scenario_parameter_field_ids) > 0
        and not scenario_matches_found
        and len(document_parameter_field_ids) == 0
    ):
        # No documents matched scenario fields and no document parameter fields selected
        # Return all documents (fallback behavior)
        return preserve_order_union_selected_first(selected_doc_ids, param_filtered)

    # Return selected items first, then filtered items
    return preserve_order_union_selected_first(selected_doc_ids, result)


def filter_valid_field_ids(
    mapping_ids: list[str],
    selected_dept_ids: list[str] | None,
    selected_field_ids: list[str] | None,
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
        if dept_data.parameter_item_ids is not None:
            all_dept_field_ids.update(dept_data.parameter_item_ids)

    selected_dept_field_ids: set[str] = set()
    for dept_id in selected_dept_ids:
        selected_dept = department_mapping.get(dept_id)
        if selected_dept is not None and selected_dept.field_ids is not None:
            selected_dept_field_ids.update(selected_dept.field_ids)

    filtered = [
        item_id
        for item_id in mapping_ids
        if item_id in selected_dept_field_ids or item_id not in all_dept_field_ids
    ]

    return preserve_order_union_selected_first(selected_field_ids, filtered)


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
    """
    Filter valid general field IDs based on selected personas, documents, and parameters.
    Replicates logic from client-side useMemo (lines 1004-1210 of Scenario.tsx).
    """
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

    # Get all fields linked to selected personas
    persona_fields: set[str] = set()
    persona_parameter_ids: set[str] = set()
    for persona_id in selected_persona_ids:
        persona = persona_mapping.get(persona_id)
        if persona and persona.field_ids:
            for field_id in persona.field_ids:
                persona_fields.add(field_id)
                field = field_mapping.get(field_id)
                if field and field.parameter_id:
                    persona_parameter_ids.add(field.parameter_id)

    # Get all fields linked to selected documents
    document_fields: set[str] = set()
    document_parameter_ids: set[str] = set()
    for doc_id in selected_doc_ids:
        doc = document_mapping.get(doc_id)
        if doc and doc.field_ids:
            for field_id in doc.field_ids:
                document_fields.add(field_id)
                field = field_mapping.get(field_id)
                if field and field.parameter_id:
                    document_parameter_ids.add(field.parameter_id)

        # Also check document_details for field_ids (parameter_item_ids is actually field_ids)
        doc_details = next(
            (d for d in document_details if d.document_id == doc_id), None
        )
        if doc_details and doc_details.field_ids:  # Renamed from parameter_item_ids
            for field_id in doc_details.field_ids:
                document_fields.add(field_id)
                field = field_mapping.get(field_id)
                if field and field.parameter_id:
                    document_parameter_ids.add(field.parameter_id)

    # Combined set of parameters that selected personas/documents have fields from
    selected_entity_parameter_ids = persona_parameter_ids | document_parameter_ids

    # Get conditional parameters from selected fields
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

    # Return selected fields first, then filtered fields
    return preserve_order_union_selected_first(selected_field_ids, filtered_result)


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            parsed = json.loads(data)  # type: ignore[no-any-return]
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                return parsed
            return {}
        except json.JSONDecodeError:
            return {}
    if isinstance(data, dict):
        return data
    if isinstance(data, list):
        return data
    return None


@router.post("/detail", response_model=VideoDetailResponse)
async def get_video_detail(
    request_data: VideoDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> VideoDetailResponse:
    """Get detailed video information."""
    tags = ["videos"]  # From router tags

    # Check for cache bypass header (for hard refresh or randomization)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"
    # Also bypass cache when randomize param is present (each randomization should be unique)
    if request_data.randomize:
        bypass_cache = True

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return VideoDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/videos/get_video_detail_complete.sql")
        sql_params = (request_data.videoId, request_data.profileId)

        # Execute query
        video = await conn.fetchrow(
            sql_query, request_data.videoId, request_data.profileId
        )
        if not video:
            # Check if video exists but user doesn't have department access
            video_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM videos WHERE id = $1)",
                request_data.videoId,
            )
            if video_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this video. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Video not found: {request_data.videoId}"
            )

        # Parse department_mapping from JSONB
        department_mapping_data = parse_jsonb(video.get("department_mapping"))
        department_mapping: DepartmentMapping = {}
        if isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):

                    def to_str_list(value: Sequence[Any] | None) -> list[str] | None:
                        if value is None:
                            return None
                        if isinstance(value, list):
                            return [str(v) for v in value if v is not None]
                        return None

                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        persona_ids=to_str_list(ddata.get("persona_ids")),
                        document_ids=to_str_list(ddata.get("document_ids")),
                        parameter_ids=to_str_list(ddata.get("parameter_ids")),
                        parameter_item_ids=to_str_list(
                            ddata.get("parameter_item_ids")
                        ),  # Database column name (keeping as-is)
                    )

        # Parse questions from JSONB into strongly typed models
        questions_data = parse_jsonb(video.get("questions"))
        questions: list[QuestionResponse] = []
        if isinstance(questions_data, list):
            for q_data in questions_data:
                if isinstance(q_data, dict):
                    options: list[QuestionOptionResponse] = []
                    if isinstance(q_data.get("options"), list):
                        for opt_data in q_data.get("options", []):
                            if isinstance(opt_data, dict):
                                options.append(
                                    QuestionOptionResponse(
                                        option_id=str(opt_data.get("option_id", "")),
                                        option_text=str(
                                            opt_data.get("option_text", "")
                                        ),
                                        type=str(opt_data.get("type", "discrete")),
                                        is_correct=bool(
                                            opt_data.get("is_correct", False)
                                        ),
                                    )
                                )
                    times = q_data.get("times", [])
                    if not isinstance(times, list):
                        times = []
                    questions.append(
                        QuestionResponse(
                            question_id=str(q_data.get("question_id", "")),
                            question_text=str(q_data.get("question_text", "")),
                            allow_multiple=bool(q_data.get("allow_multiple", False)),
                            times=[
                                int(t)
                                for t in times
                                if isinstance(t, (int, str)) and str(t).isdigit()
                            ],
                            options=options,
                        )
                    )
        elif questions_data is None:
            questions = []

        dept_ids = None
        if video.get("department_ids"):
            dept_ids = [str(d) for d in video["department_ids"]]

        valid_dept_ids = video.get("valid_department_ids") or []
        if not isinstance(valid_dept_ids, list):
            valid_dept_ids = []

        # Parse outline_mapping from JSONB
        outline_mapping_data = parse_jsonb(video.get("outline_mapping"))
        outline_mapping: dict[str, dict[str, str]] = {}
        if isinstance(outline_mapping_data, dict):
            outline_mapping = {
                k: {
                    "name": v.get("name", ""),
                    "outline": v.get("outline", ""),
                    "created_at": v.get("created_at", ""),
                    "updated_at": v.get("updated_at", ""),
                }
                for k, v in outline_mapping_data.items()
            }

        # Parse document_mapping from JSONB
        document_mapping_data = parse_jsonb(video.get("document_mapping"))
        document_mapping_dict: dict[str, dict[str, Any]] = {}
        document_mapping: DocumentMapping = {}
        if isinstance(document_mapping_data, dict):
            for k, v in document_mapping_data.items():
                if isinstance(v, dict):
                    parameter_ids = v.get("parameter_ids", [])
                    field_ids = v.get("field_ids", [])
                    parent_document_id = v.get("parent_document_id")
                    document_mapping_dict[k] = {
                        "name": v.get("name", ""),
                        "description": v.get("description", ""),
                        "extension": v.get("extension", ""),
                        "filePath": v.get("filePath", ""),
                        "mimeType": v.get("mimeType", ""),
                        "uploadId": v.get("uploadId", ""),
                        "parameter_ids": [str(p) for p in parameter_ids]
                        if isinstance(parameter_ids, list)
                        else [],
                        "field_ids": [str(f) for f in field_ids]
                        if isinstance(field_ids, list)
                        else [],
                    }
                    document_mapping[k] = DocumentMappingItem(
                        name=v.get("name", ""),
                        description=v.get("description", ""),
                        filePath=v.get("filePath", ""),
                        mimeType=v.get("mimeType", ""),
                        parameter_ids=v.get("parameter_ids", []),
                        field_ids=v.get("field_ids", []),
                        parent_document_id=str(parent_document_id)
                        if parent_document_id
                        else None,
                    )

        # Parse document_details from JSONB
        document_details: list[DocumentDetailItem] = []
        doc_details_data = parse_jsonb(video.get("document_details"))
        if isinstance(doc_details_data, list):
            for doc in doc_details_data:
                if isinstance(doc, dict):
                    document_details.append(
                        DocumentDetailItem(
                            document_id=doc.get("document_id", ""),
                            name=doc.get("name", ""),
                            updatedAt=doc.get("updatedAt", ""),
                            extension=doc.get("extension") or "",
                            scenario_ids=doc.get("scenario_ids", []),
                            can_edit=doc.get("can_edit", True),
                            can_delete=doc.get("can_delete", True),
                            active=doc.get("active", True),
                            department_ids=[
                                str(d) for d in doc.get("department_ids", [])
                            ]
                            if doc.get("department_ids")
                            else None,
                            file_path=doc.get("file_path") or None,
                            mime_type=doc.get("mime_type") or None,
                            upload_id=doc.get("upload_id") or None,
                            field_ids=doc.get(
                                "parameter_item_ids", []
                            ),  # Database column name (keeping as-is), renamed to field_ids in model
                            is_template=doc.get("is_template", False),
                        )
                    )

        # Parse video_images from JSONB
        video_images_data = parse_jsonb(video.get("video_images"))
        video_images: list[dict[str, Any]] = []
        if isinstance(video_images_data, list):
            video_images = [
                {
                    "id": img.get("upload_id") or img.get("id", ""),
                    "name": img.get("name", ""),
                    "upload_id": img.get("upload_id") or img.get("id", ""),
                    "file_path": img.get("file_path", ""),
                    "mime_type": img.get("mime_type", ""),
                    "active": img.get("active", True),
                }
                for img in video_images_data
                if isinstance(img, dict)
            ]

        outline_ids = video.get("outline_ids") or []
        if not isinstance(outline_ids, list):
            outline_ids = []

        document_ids = video.get("document_ids") or []
        if not isinstance(document_ids, list):
            document_ids = []

        valid_document_ids = video.get("valid_document_ids") or []
        if not isinstance(valid_document_ids, list):
            valid_document_ids = []

        # Parse objectives_history
        objectives_history = video.get("objectives_history") or []
        if not isinstance(objectives_history, list):
            objectives_history = []

        # Parse agent_mapping
        agent_mapping: AgentMapping = {}
        agent_mapping_data = parse_jsonb(video.get("agent_mapping"))
        if isinstance(agent_mapping_data, dict):
            for agent_id, adata in agent_mapping_data.items():
                if isinstance(adata, dict):
                    roles = adata.get("roles", [])
                    if isinstance(roles, str):
                        try:
                            roles = json.loads(roles)
                        except json.JSONDecodeError:
                            roles = []
                    if not isinstance(roles, list):
                        roles = []
                    agent_mapping[agent_id] = AgentMappingItem(
                        name=adata.get("name", ""),
                        description=adata.get("description", ""),
                        roles=[str(r) for r in roles],
                    )

        valid_agent_ids = [str(aid) for aid in (video.get("valid_agent_ids") or [])]

        # Parse parameter_mapping from JSONB
        parameter_mapping_data = parse_jsonb(video.get("parameter_mapping"))
        parameter_mapping: ParameterMapping = {}
        if isinstance(parameter_mapping_data, dict):
            for param_id, pdata in parameter_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[param_id] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        numerical=pdata.get("numerical", False),
                        document_parameter=pdata.get("document_parameter", False),
                        persona_parameter=pdata.get("persona_parameter", False),
                        scenario_parameter=pdata.get("scenario_parameter", False),
                        video_parameter=pdata.get("video_parameter", False),
                    )

        # Parse parameter_item_mapping from JSONB
        field_mapping_data = parse_jsonb(video.get("field_mapping"))
        field_mapping: FieldMapping = {}
        if isinstance(field_mapping_data, dict):
            for item_id, idata in field_mapping_data.items():
                if isinstance(idata, dict):
                    field_mapping[item_id] = FieldMappingItem(
                        name=idata.get("name", ""),
                        description=idata.get("description", ""),
                        parameter_id=idata.get("parameter_id", ""),
                        parameter_name=idata.get("parameter_name", ""),
                    )

        # Parse parameter_item_ids
        parameter_item_ids = video.get("parameter_item_ids") or []
        if not isinstance(parameter_item_ids, list):
            parameter_item_ids = []
        parameter_item_ids = [str(pid) for pid in parameter_item_ids]

        # Parse persona_ids
        persona_ids = video.get("persona_ids") or []
        if not isinstance(persona_ids, list):
            persona_ids = []
        persona_ids = [str(pid) for pid in persona_ids]

        # Parse persona_mapping from JSONB
        persona_mapping_data = parse_jsonb(video.get("persona_mapping"))
        persona_mapping: PersonaMapping = {}
        if isinstance(persona_mapping_data, dict):
            for persona_id, pdata in persona_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_ids = pdata.get("parameter_ids")
                    field_ids = pdata.get("field_ids")
                    persona_mapping[persona_id] = PersonaMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        color=pdata.get("color", ""),
                        icon=pdata.get("icon", ""),
                        image_model=pdata.get("image_model", False),
                        parameter_ids=[str(p) for p in parameter_ids]
                        if isinstance(parameter_ids, list)
                        else None,
                        field_ids=[str(f) for f in field_ids]
                        if isinstance(field_ids, list)
                        else None,
                    )

        # Parse valid_persona_ids
        valid_persona_ids = video.get("valid_persona_ids") or []
        if not isinstance(valid_persona_ids, list):
            valid_persona_ids = []
        valid_persona_ids = [str(pid) for pid in valid_persona_ids]

        # Parse video_parameter_ids and valid_parameter_ids
        video_parameter_ids = video.get("parameter_ids") or []
        if not isinstance(video_parameter_ids, list):
            video_parameter_ids = []
        video_parameter_ids = [str(pid) for pid in video_parameter_ids]

        # valid_parameter_ids are all keys in parameter_mapping
        valid_parameter_ids = list(parameter_mapping.keys())

        # Extract upload_id and convert to string if present
        upload_id_raw = video.get("upload_id")
        upload_id = str(upload_id_raw) if upload_id_raw is not None else None

        # Construct video_url if upload_id exists
        video_url = None
        if upload_id:
            video_url = f"/api/v3/uploads/download/{upload_id}"

        # Apply filtering and randomization (matching scenario pattern)
        filtered_valid_persona_ids: list[str] = valid_persona_ids
        filtered_valid_document_ids: list[str] = [
            str(did) for did in valid_document_ids
        ]
        filtered_valid_field_ids: list[str] | None = None
        filtered_valid_general_field_ids: list[str] | None = None
        allowed_ranges: AllowedRanges | None = None
        randomized_selections: RandomizedSelections | None = None

        # Always compute filtered_valid_general_field_ids if randomize is present
        needs_filtering = (
            request_data.departmentIds is not None
            or request_data.personaIds is not None
            or request_data.documentIds is not None
            or request_data.parameterIds is not None
            or request_data.fieldIds is not None
            or request_data.randomize is not None
        )

        # Only apply filtering if filter parameters are provided or randomize is present
        if needs_filtering:
            # Filter valid persona IDs
            filtered_valid_persona_ids = filter_valid_persona_ids(
                base_ids=valid_persona_ids,
                selected_dept_ids=request_data.departmentIds,
                selected_param_ids=request_data.parameterIds,
                selected_field_ids=request_data.fieldIds,
                selected_persona_ids=request_data.personaIds,
                department_mapping=department_mapping,
                persona_mapping=persona_mapping,
                field_mapping=field_mapping,
            )

            # Filter valid document IDs
            filtered_valid_document_ids = filter_valid_document_ids(
                base_ids=[str(did) for did in valid_document_ids],
                selected_dept_ids=request_data.departmentIds,
                selected_param_ids=request_data.parameterIds,
                selected_field_ids=request_data.fieldIds,
                selected_doc_ids=request_data.documentIds,
                selected_field_ids_for_docs=request_data.fieldIds,  # Renamed from parameterItemIds
                department_mapping=department_mapping,
                document_mapping=document_mapping,
                field_mapping=field_mapping,
                parameter_mapping=parameter_mapping,
                document_details=document_details,
            )

            # Filter valid field IDs
            mapping_ids = list(field_mapping.keys())
            filtered_valid_field_ids = filter_valid_field_ids(
                mapping_ids=mapping_ids,
                selected_dept_ids=request_data.departmentIds,
                selected_field_ids=request_data.fieldIds,
                department_mapping=department_mapping,
            )

            # Filter valid general field IDs
            filtered_valid_general_field_ids = filter_valid_general_field_ids(  # Renamed from filter_valid_general_parameter_item_ids
                valid_field_ids=filtered_valid_field_ids
                or mapping_ids,  # Renamed from valid_parameter_item_ids
                selected_param_ids=request_data.parameterIds,
                selected_persona_ids=request_data.personaIds,
                selected_doc_ids=request_data.documentIds,
                selected_field_ids=request_data.fieldIds,  # Renamed from parameterItemIds
                persona_mapping=persona_mapping,
                document_mapping=document_mapping,
                field_mapping=field_mapping,  # Renamed from parameter_item_mapping
                document_details=document_details,
            )
        elif request_data.randomize:
            # When randomize is present but no filter params, still need filtered_valid_general_field_ids
            # Initialize with base values (no filtering applied)
            mapping_ids = list(
                field_mapping.keys()
            )  # Renamed from parameter_item_mapping
            filtered_valid_field_ids = (
                mapping_ids  # Renamed from filtered_valid_parameter_item_ids
            )
            filtered_valid_general_field_ids = filter_valid_general_field_ids(  # Renamed from filter_valid_general_parameter_item_ids
                valid_field_ids=filtered_valid_field_ids,  # Renamed from valid_parameter_item_ids
                selected_param_ids=None,
                selected_persona_ids=None,
                selected_doc_ids=None,
                selected_field_ids=None,  # Renamed from selected_param_item_ids
                persona_mapping=persona_mapping,
                document_mapping=document_mapping,
                field_mapping=field_mapping,  # Renamed from parameter_item_mapping
                document_details=document_details,
            )

        # Fixed ranges (server is source of truth, not based on available items)
        # Personas: 1-3 (range), default value: 1
        # The allowed range is always 1-3, request params are for current values
        persona_min = (
            request_data.personaMin if request_data.personaMin is not None else 1
        )
        persona_max = (
            request_data.personaMax if request_data.personaMax is not None else 1
        )
        # Allowed range is always 1-3 (fixed limits)
        allowed_persona_min = 1
        allowed_persona_max = 3
        # Ensure requested values are within allowed range
        persona_min = max(allowed_persona_min, min(persona_min, allowed_persona_max))
        persona_max = max(allowed_persona_min, min(persona_max, allowed_persona_max))
        # Ensure min doesn't exceed max
        persona_min = min(persona_min, persona_max)

        # Documents: 0-3 (range), default value: 1
        # The allowed range is always 0-3, request params are for current values
        document_min = (
            request_data.documentMin if request_data.documentMin is not None else 0
        )
        document_max = (
            request_data.documentMax if request_data.documentMax is not None else 1
        )
        # Allowed range is always 0-3 (fixed limits)
        allowed_document_min = 0
        allowed_document_max = 3
        # Ensure requested values are within allowed range
        document_min = max(
            allowed_document_min, min(document_min, allowed_document_max)
        )
        document_max = max(
            allowed_document_min, min(document_max, allowed_document_max)
        )
        # Ensure min doesn't exceed max
        document_min = min(document_min, document_max)

        # Parameters: 0-3 (range), default value: 3
        # The allowed range is always 0-3, request params are for current values
        parameter_selection_min = (
            request_data.parameterSelectionMin
            if request_data.parameterSelectionMin is not None
            else 0
        )
        parameter_selection_max = (
            request_data.parameterSelectionMax
            if request_data.parameterSelectionMax is not None
            else 3
        )
        # Allowed range is always 0-3 (fixed limits)
        allowed_parameter_min = 0
        allowed_parameter_max = 3
        # Ensure requested values are within allowed range
        parameter_selection_min = max(
            allowed_parameter_min, min(parameter_selection_min, allowed_parameter_max)
        )
        parameter_selection_max = max(
            allowed_parameter_min, min(parameter_selection_max, allowed_parameter_max)
        )
        # Ensure min doesn't exceed max
        parameter_selection_min = min(parameter_selection_min, parameter_selection_max)

        # For randomization, we still need to cap based on available items
        max_valid_personas = len(filtered_valid_persona_ids)
        max_valid_documents = len(filtered_valid_document_ids)
        max_valid_parameters = len(valid_parameter_ids)

        # Per-parameter field ranges
        # Always set default ranges for all valid parameters (fixed ranges, not based on available items)
        field_ranges_dict: dict[str, dict[str, int]] = {}
        # Use valid_parameter_ids to ensure we include all valid parameters
        for param_id in valid_parameter_ids:
            # Parameter fields: 1-3 (default max: 1) - fixed range
            if request_data.fieldRanges and param_id in request_data.fieldRanges:
                param_range = request_data.fieldRanges[param_id]
                param_min = param_range.get("min", 1)
                param_max = param_range.get("max", 1)
            else:
                param_min = 1
                param_max = 1
            # Ensure max doesn't exceed fixed limit
            param_max = min(param_max, 3)
            # Ensure min doesn't exceed max
            param_min = min(param_min, param_max)

            field_ranges_dict[param_id] = {"min": param_min, "max": param_max}

        # Allowed ranges are fixed limits (not current values)
        # Personas: 1-3, Documents: 0-3, Parameters: 0-3, Fields: 1-3
        allowed_ranges = AllowedRanges(
            persona=RangeMinMax(min=1, max=3),  # Fixed allowed range
            document=RangeMinMax(min=0, max=3),  # Fixed allowed range
            parameter_selection=RangeMinMax(min=0, max=3),  # Fixed allowed range
            fields={  # Renamed from parameter_items
                param_id: RangeMinMax(min=1, max=3)  # Fixed allowed range per parameter
                for param_id in field_ranges_dict.keys()
            },
        )

        # Handle randomization if requested
        import random

        randomized_persona_ids: list[str] | None = None
        randomized_document_ids: list[str] | None = None
        randomized_parameter_ids: list[str] | None = None
        randomized_field_ids: list[str] | None = None

        if request_data.randomize:
            randomize_value = request_data.randomize.strip().lower()

            # Parse randomize value and apply randomization accordingly
            if randomize_value == "all":
                # Randomize personas
                try:
                    min_val = persona_min
                    max_val = persona_max
                    capped_max = min(max_val, max_valid_personas)
                    count = min(
                        capped_max,
                        max(min_val, random.randint(min_val, capped_max)),
                    )
                    shuffled = filtered_valid_persona_ids.copy()
                    random.shuffle(shuffled)
                    randomized_persona_ids = shuffled[:count]
                except (ValueError, IndexError):
                    pass

                # Randomize documents
                try:
                    min_val = document_min
                    max_val = document_max
                    capped_max = min(max_val, max_valid_documents)
                    count = min(
                        capped_max,
                        max(min_val, random.randint(min_val, capped_max)),
                    )
                    shuffled = filtered_valid_document_ids.copy()
                    random.shuffle(shuffled)
                    randomized_document_ids = shuffled[:count]
                except (ValueError, IndexError):
                    pass

                # Randomize parameters
                try:
                    min_val = parameter_selection_min
                    max_val = parameter_selection_max
                    capped_max = min(max_val, max_valid_parameters)
                    count = min(
                        capped_max,
                        max(min_val, random.randint(min_val, capped_max)),
                    )
                    shuffled = valid_parameter_ids.copy()
                    random.shuffle(shuffled)
                    randomized_parameter_ids = shuffled[:count]
                except (ValueError, IndexError):
                    pass

                # Randomize all fields
                # When randomizing "all", randomize fields for ALL valid parameters (not just randomized/selected ones)
                if filtered_valid_general_field_ids:
                    randomized_items: list[str] = []
                    # When randomizing "all", always randomize fields for ALL valid parameters
                    # (not just the randomized parameters subset)
                    # For other randomize types, use randomized/selected parameters
                    if randomize_value == "all":
                        # Always use all valid parameters when randomizing "all"
                        params_to_randomize = valid_parameter_ids
                    elif randomized_parameter_ids:
                        params_to_randomize = randomized_parameter_ids
                    elif request_data.parameterIds:
                        params_to_randomize = request_data.parameterIds
                    else:
                        # No parameters selected - use all valid parameters as fallback
                        params_to_randomize = valid_parameter_ids
                    for param_id in params_to_randomize:
                        if param_id in field_ranges_dict:
                            param_range = field_ranges_dict[param_id]
                            try:
                                min_val = param_range["min"]
                                max_val = param_range["max"]
                                valid_items_for_param = [
                                    item_id
                                    for item_id in filtered_valid_general_field_ids
                                    if item_id in field_mapping
                                    and field_mapping[item_id].parameter_id == param_id
                                ]
                                if valid_items_for_param:
                                    # Cap based on available items for randomization
                                    max_valid_items = len(valid_items_for_param)
                                    capped_max = min(max_val, max_valid_items)
                                    count = min(
                                        capped_max,
                                        max(
                                            min_val, random.randint(min_val, capped_max)
                                        ),
                                    )
                                    shuffled = valid_items_for_param.copy()
                                    random.shuffle(shuffled)
                                    randomized_items.extend(shuffled[:count])
                            except (ValueError, IndexError):
                                pass
                    if randomized_items:
                        randomized_field_ids = randomized_items

            elif randomize_value == "persona":
                # Randomize personas only
                try:
                    min_val = persona_min
                    max_val = persona_max
                    capped_max = min(max_val, max_valid_personas)
                    count = min(
                        capped_max,
                        max(min_val, random.randint(min_val, capped_max)),
                    )
                    shuffled = filtered_valid_persona_ids.copy()
                    random.shuffle(shuffled)
                    randomized_persona_ids = shuffled[:count]
                except (ValueError, IndexError):
                    pass

            elif randomize_value == "document":
                # Randomize documents only
                try:
                    min_val = document_min
                    max_val = document_max
                    capped_max = min(max_val, max_valid_documents)
                    count = min(
                        capped_max,
                        max(min_val, random.randint(min_val, capped_max)),
                    )
                    shuffled = filtered_valid_document_ids.copy()
                    random.shuffle(shuffled)
                    randomized_document_ids = shuffled[:count]
                except (ValueError, IndexError):
                    pass

            elif randomize_value == "parameters":
                # Randomize parameters only
                try:
                    min_val = parameter_selection_min
                    max_val = parameter_selection_max
                    capped_max = min(max_val, max_valid_parameters)
                    count = min(
                        capped_max,
                        max(min_val, random.randint(min_val, capped_max)),
                    )
                    shuffled = valid_parameter_ids.copy()
                    random.shuffle(shuffled)
                    randomized_parameter_ids = shuffled[:count]
                except (ValueError, IndexError):
                    pass

            elif randomize_value.startswith("parameter_"):
                # Randomize fields for specific parameter (format: "parameter_{param_id}")
                param_id = randomize_value.replace("parameter_", "")
                if param_id in field_ranges_dict and filtered_valid_general_field_ids:
                    param_range = field_ranges_dict[param_id]
                    try:
                        min_val = param_range["min"]
                        max_val = param_range["max"]
                        valid_items_for_param = [
                            item_id
                            for item_id in filtered_valid_general_field_ids
                            if item_id in field_mapping
                            and field_mapping[item_id].parameter_id == param_id
                        ]
                        capped_max = min(max_val, len(valid_items_for_param))
                        count = min(
                            capped_max,
                            max(min_val, random.randint(min_val, capped_max)),
                        )
                        shuffled = valid_items_for_param.copy()
                        random.shuffle(shuffled)
                        randomized_field_ids = shuffled[:count]
                    except (ValueError, IndexError):
                        pass

        # Determine if randomization occurred
        randomization_occurred = (
            randomized_persona_ids is not None
            or randomized_document_ids is not None
            or randomized_parameter_ids is not None
            or randomized_field_ids is not None
        )

        if randomization_occurred:
            randomized_selections = RandomizedSelections(
                personaIds=randomized_persona_ids,
                documentIds=randomized_document_ids,
                parameterIds=randomized_parameter_ids,
                fieldIds=randomized_field_ids,
            )

        # Apply randomized values to main fields (DHH-style: server applies directly)
        # Use randomized values if available, otherwise use existing video values
        final_persona_ids = (
            randomized_persona_ids
            if randomized_persona_ids is not None
            else persona_ids
        )
        final_document_ids = (
            randomized_document_ids
            if randomized_document_ids is not None
            else document_ids
        )
        final_parameter_ids = (
            randomized_parameter_ids
            if randomized_parameter_ids is not None
            else video_parameter_ids
        )
        # For fields, use randomized_field_ids if set, otherwise use selected_field_ids from request
        final_field_ids = (
            randomized_field_ids if randomized_field_ids is not None else None
        )

        # Save filtered_valid_document_ids before search filter for selected_document_ids intersection
        # Search term should only affect valid_document_ids for display, not selected_document_ids
        filtered_valid_document_ids_before_search = filtered_valid_document_ids

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

        # Filter selected IDs from request to only include valid ones (server-driven approach)
        # Note: These are used as fallback if no randomization occurred
        selected_persona_ids: list[str] | None = None
        selected_document_ids: list[str] | None = None
        selected_parameter_ids: list[str] | None = None
        selected_field_ids: list[str] | None = None

        if request_data.personaIds:
            # Intersect requested IDs with valid filtered IDs
            selected_persona_ids = [
                pid
                for pid in request_data.personaIds
                if pid in filtered_valid_persona_ids
            ]

        if request_data.documentIds:
            # Intersect requested IDs with valid filtered IDs (before search filter)
            # Search term should only affect display, not selected documents
            selected_document_ids = [
                did
                for did in request_data.documentIds
                if did in filtered_valid_document_ids_before_search
            ]

        if request_data.parameterIds:
            # Intersect requested IDs with valid parameter IDs
            selected_parameter_ids = [
                pid for pid in request_data.parameterIds if pid in valid_parameter_ids
            ]

        if request_data.fieldIds:
            # Intersect requested IDs with valid general field IDs
            if filtered_valid_general_field_ids:
                selected_field_ids = [
                    item_id
                    for item_id in request_data.fieldIds
                    if item_id in filtered_valid_general_field_ids
                ]
            else:
                # Fallback to valid field IDs if general not available
                if filtered_valid_field_ids:
                    selected_field_ids = [
                        item_id
                        for item_id in request_data.fieldIds
                        if item_id in filtered_valid_field_ids
                    ]

        response_data = VideoDetailResponse(
            name=video["name"],
            length_seconds=video["length_seconds"],
            active=video["active"],
            upload_id=upload_id,
            video_url=video_url,
            department_ids=dept_ids,
            valid_department_ids=[str(did) for did in valid_dept_ids],
            outline_ids=[str(oid) for oid in outline_ids],
            outline_mapping=outline_mapping,
            # document_ids will be set below with final values
            document_mapping=document_mapping_dict,
            document_details=document_details,
            valid_document_ids=filtered_valid_document_ids,
            video_images=video_images,
            objectives_history=[str(obj) for obj in objectives_history],
            can_edit=video["can_edit"],
            can_duplicate=video["can_duplicate"],
            can_delete=video["can_delete"],
            department_mapping=department_mapping,
            questions=questions,
            outline_agent_id=video.get("outline_agent_id", ""),
            image_agent_id=video.get("image_agent_id", ""),
            video_agent_id=video.get("video_agent_id", "") or "",
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
            parameter_mapping=parameter_mapping,
            field_mapping=field_mapping,
            parameter_item_ids=parameter_item_ids,
            valid_parameter_ids=valid_parameter_ids,
            # persona_ids and video_parameter_ids will be set below with final values
            persona_mapping=persona_mapping,
            valid_persona_ids=filtered_valid_persona_ids,
            valid_field_ids=filtered_valid_field_ids,
            valid_general_field_ids=filtered_valid_general_field_ids,
            allowed_ranges=allowed_ranges,
            # Questions: 0-3 (default: 1) - calculated max from video length, min=1 for edit mode
            question_count_range=RangeMinMax(
                min=1,
                max=min(3, (video["length_seconds"] // 4) + 1),
            ),
            randomized_selections=randomized_selections,
            randomized=randomization_occurred,
            # IDs (apply randomized values directly to main fields)
            persona_ids=[str(pid) for pid in final_persona_ids],
            document_ids=[str(did) for did in final_document_ids],
            video_parameter_ids=[str(pid) for pid in final_parameter_ids],
            selected_persona_ids=selected_persona_ids,
            selected_document_ids=selected_document_ids,
            selected_template_document_ids=request_data.templateDocumentIds or [],
            selected_parameter_ids=selected_parameter_ids,
            selected_field_ids=final_field_ids
            if final_field_ids is not None
            else selected_field_ids,  # Apply randomized values
            persona_search=request_data.personaSearch,
            document_search=request_data.documentSearch,
            parameter_search=request_data.parameterSearch,
            # Range values from request (default to 1 for personas, 1 for documents, 3 for parameters)
            persona_min=persona_min,  # Already validated and defaulted to 1
            persona_max=persona_max,  # Already validated and defaulted to 1
            document_min=document_min,  # Already validated and defaulted to 0
            document_max=document_max,  # Already validated and defaulted to 1
            parameter_selection_min=parameter_selection_min,  # Already validated and defaulted to 0
            parameter_selection_max=parameter_selection_max,  # Already validated and defaulted to 3
            field_ranges=request_data.fieldRanges,  # Use request values like scenarios
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_video_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
