"""Scenario detail endpoint - v3 API following DHH principles."""

import json
from collections.abc import Sequence
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (
    AgentMapping,
    AgentMappingItem,
    DepartmentMapping,
    DepartmentMappingItem,
    DocumentMapping,
    DocumentMappingItem,
    FieldMapping,
    FieldMappingItem,
    ObjectiveMapping,
    ObjectiveMappingItem,
    ParameterMapping,
    ParameterMappingItem,
    PersonaMapping,
    PersonaMappingItem,
    SimulationMapping,
    SimulationMappingItem,
)
from app.utils.sql_helper import load_sql


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
    objectivesMin: int | None = None
    objectivesMax: int | None = None
    # Per-parameter field ranges (dict: {paramId: {"min": int, "max": int}})
    fieldRanges: dict[str, dict[str, int]] | None = (
        None  # Renamed from parameterItemRanges
    )
    # Randomization parameter (single param: "all", "persona", "document", "parameters", or "parameter_{field_id}")
    randomize: str | None = None
    # Agent filtering parameters
    useImage: bool | None = None
    # URL parameters for linking generated resources
    imageIds: list[str] | None = None
    objectiveIds: list[str] | None = None
    problemStatementIds: list[str] | None = None


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


class ProblemStatementInfo(BaseModel):
    """Problem statement information for version history."""

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
    problem_statement: str
    problem_statement_id: str | None
    active: bool
    generated: bool
    parent_scenario_id: str | None
    documents_enabled: bool
    document_vision_enabled: bool
    objectives_enabled: bool
    image_enabled: bool

    # Department
    department_ids: list[str] | None
    valid_department_ids: list[str]

    # IDs
    persona_ids: list[str]
    valid_persona_ids: list[str]
    document_ids: list[str]
    valid_document_ids: list[str]
    scenario_images: list[dict[str, Any]]

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
    agent_mapping: AgentMapping
    valid_agent_ids: list[str]
    # Filtered valid IDs (replacing client-side filtering)
    valid_field_ids: list[str] | None = (
        None  # Renamed from valid_parameter_item_ids - filtered based on departments
    )
    valid_general_field_ids: list[str] | None = (
        None  # Renamed from valid_general_parameter_item_ids - filtered based on personas/documents/parameters
    )
    # Allowed ranges (computed from filtered IDs, capped at 5)
    allowed_ranges: AllowedRanges | None = None
    # Objective count range (default: min=0, max=5)
    objective_count_range: RangeMinMax
    # Randomized selections (if randomization params provided)
    randomized_selections: RandomizedSelections | None = None


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
        return preserve_order_union_selected_first(selected_persona_ids, base_ids)

    all_dept_persona_ids: set[str] = set()
    for dept_data in department_mapping.values():
        if dept_data.persona_ids is not None:
            all_dept_persona_ids.update(dept_data.persona_ids)

    selected_dept_persona_ids: set[str] = set()
    for dept_id in selected_dept_ids:
        dept_data = department_mapping.get(dept_id)
        if dept_data and dept_data.persona_ids is not None:
            selected_dept_persona_ids.update(dept_data.persona_ids)

    filtered = [
        pid
        for pid in base_ids
        if pid in selected_dept_persona_ids or pid not in all_dept_persona_ids
    ]

    # Preserve order: selected items first, then filtered items
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
        dept_filtered_ids = preserve_order_union_selected_first(
            selected_doc_ids, base_ids
        )
    else:
        all_dept_document_ids: set[str] = set()
        for dept_data in department_mapping.values():
            if dept_data.document_ids is not None:
                all_dept_document_ids.update(dept_data.document_ids)

        selected_dept_document_ids: set[str] = set()
        for dept_id in selected_dept_ids:
            dept_data = department_mapping.get(dept_id)
            if dept_data and dept_data.document_ids is not None:
                selected_dept_document_ids.update(dept_data.document_ids)

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

    if len(selected_field_ids) == 0:
        # Return with selected items first
        return preserve_order_union_selected_first(selected_doc_ids, param_filtered)

    selected_doc_ids_for_filter = set(selected_doc_ids)

    # Build filtered result (excluding selected items)
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

        if len(all_doc_field_ids) == 0 and len(selected_field_ids) > 0:
            continue

        doc_field_set = set(all_doc_field_ids)

        has_all_fields = True
        for selected_field_id in selected_field_ids:
            if not selected_field_id:
                continue

            selected_field = field_mapping.get(
                selected_field_id
            )  # Renamed from parameter_item_mapping
            if not selected_field or not selected_field.parameter_id:
                continue

            if selected_field_id not in doc_field_set:
                has_all_fields = False
                break

        if has_all_fields:
            filtered_result.append(doc_id)

    # Return selected items first, then filtered items
    return preserve_order_union_selected_first(selected_doc_ids, filtered_result)


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
        dept_data = department_mapping.get(dept_id)
        if (
            dept_data and dept_data.field_ids is not None
        ):  # Renamed from parameter_item_ids
            selected_dept_field_ids.update(dept_data.field_ids)

    filtered = [
        item_id
        for item_id in mapping_ids
        if item_id in selected_dept_field_ids or item_id not in all_dept_field_ids
    ]

    # Preserve order: selected items first, then filtered items
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

    # Return selected fields first, then filtered fields
    return preserve_order_union_selected_first(selected_field_ids, filtered_result)


@router.post("/detail", response_model=ScenarioDetailResponse)
async def get_scenario_detail(
    request_data: ScenarioDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioDetailResponse:
    """Get detailed scenario information."""
    tags = ["scenarios"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ScenarioDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string (persona query is now merged into main query)
        sql_query = load_sql("sql/v3/scenarios/get_scenario_detail_complete.sql")

        # Convert documentIds to UUID array if provided
        document_ids_uuid = None
        if request_data.documentIds:
            import uuid as uuid_lib

            try:
                document_ids_uuid = [
                    uuid_lib.UUID(did) for did in request_data.documentIds
                ]
            except (ValueError, TypeError):
                document_ids_uuid = None

        # Convert templateDocumentIds to UUID array if provided
        template_document_ids_uuid = None
        if request_data.templateDocumentIds:
            import uuid as uuid_lib

            try:
                template_document_ids_uuid = [
                    uuid_lib.UUID(did) for did in request_data.templateDocumentIds
                ]
            except (ValueError, TypeError):
                template_document_ids_uuid = None

        # Convert problemStatementIds to UUID array if provided
        problem_statement_ids_uuid = None
        if request_data.problemStatementIds:
            import uuid as uuid_lib

            try:
                problem_statement_ids_uuid = [
                    uuid_lib.UUID(psid) for psid in request_data.problemStatementIds
                ]
            except (ValueError, TypeError):
                problem_statement_ids_uuid = None

        # Derive useObjectives from objectivesMax for backward compatibility with SQL
        use_objectives = (
            request_data.objectivesMax is not None and request_data.objectivesMax > 0
        )
        sql_params = (
            request_data.scenarioId,
            request_data.profileId,
            request_data.useImage,
            use_objectives,
            document_ids_uuid,
            problem_statement_ids_uuid,
            template_document_ids_uuid,
        )

        # Execute query
        scenario = await conn.fetchrow(sql_query, *sql_params)
        if not scenario:
            # Check if scenario exists but user doesn't have department access
            scenario_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM scenarios WHERE id = $1)",
                request_data.scenarioId,
            )
            if scenario_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this scenario. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Scenario not found: {request_data.scenarioId}"
            )

        # Get persona_ids from query result (already included in main query)
        persona_ids = scenario.get("persona_ids", [])
        if persona_ids and not isinstance(persona_ids, list):
            persona_ids = [str(persona_ids)] if persona_ids else []
        elif persona_ids:
            persona_ids = [str(pid) for pid in persona_ids if pid]

        # Parse JSONB data with type safety
        def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
            if isinstance(data, str):
                try:
                    parsed = json.loads(data)  # type: ignore[no-any-return]
                    if isinstance(parsed, dict):
                        return cast(dict[str, Any], parsed)
                    if isinstance(parsed, list):
                        return parsed
                    return {}
                except json.JSONDecodeError:
                    return {}
            if isinstance(data, dict):
                return cast(dict[str, Any], data)
            if isinstance(data, list):
                return data
            return None

        # Parse parameters
        parameters_dict: dict[str, ParameterDetail] = {}
        params_data = parse_jsonb(scenario.get("parameters_json"))
        if isinstance(params_data, dict):
            for param_id, param_detail in params_data.items():
                if isinstance(param_detail, dict):
                    field_ids = param_detail.get(
                        "parameter_item_ids", []
                    )  # Database column name (keeping as-is)
                    valid_field_ids = param_detail.get(
                        "valid_parameter_item_ids",
                        [],  # Database column name (keeping as-is)
                    )
                    if not isinstance(field_ids, list):
                        field_ids = []
                    if not isinstance(valid_field_ids, list):
                        valid_field_ids = []
                    parameters_dict[param_id] = ParameterDetail(
                        field_ids=field_ids,  # Renamed from parameter_item_ids
                        valid_field_ids=valid_field_ids,  # Renamed from valid_parameter_item_ids
                    )

        # Parse mappings
        objective_mapping: ObjectiveMapping = {}
        obj_mapping_data = parse_jsonb(scenario.get("objective_mapping"))
        if isinstance(obj_mapping_data, dict):
            for oid, odata in obj_mapping_data.items():
                if isinstance(odata, dict):
                    objective_mapping[oid] = ObjectiveMappingItem(
                        name=odata.get("name", ""),
                        description=odata.get("description", ""),
                    )

        persona_mapping: PersonaMapping = {}
        persona_mapping_data = parse_jsonb(scenario.get("persona_mapping"))
        if isinstance(persona_mapping_data, dict):
            for pid, pdata in persona_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_ids = pdata.get("parameter_ids")
                    field_ids = pdata.get("field_ids")
                    persona_mapping[pid] = PersonaMappingItem(
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

        document_mapping: DocumentMapping = {}
        doc_mapping_data = parse_jsonb(scenario.get("document_mapping"))
        if isinstance(doc_mapping_data, dict):
            for did, ddata in doc_mapping_data.items():
                if isinstance(ddata, dict):
                    parameter_ids = ddata.get("parameter_ids")
                    field_ids = ddata.get("field_ids")
                    parent_document_id = ddata.get("parent_document_id")
                    document_mapping[did] = DocumentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        filePath=ddata.get("filePath"),
                        mimeType=ddata.get("mimeType"),
                        parameter_ids=[str(p) for p in parameter_ids]
                        if isinstance(parameter_ids, list)
                        else None,
                        field_ids=[str(f) for f in field_ids]
                        if isinstance(field_ids, list)
                        else None,
                        parent_document_id=str(parent_document_id)
                        if parent_document_id
                        else None,
                    )

        simulation_mapping: SimulationMapping = {}
        sim_mapping_data = parse_jsonb(scenario.get("simulation_mapping"))
        if isinstance(sim_mapping_data, dict):
            for sid, sdata in sim_mapping_data.items():
                if isinstance(sdata, dict):
                    dept_ids = sdata.get("department_ids")
                    if isinstance(dept_ids, str):
                        try:
                            dept_ids = json.loads(dept_ids)
                        except (json.JSONDecodeError, ValueError):
                            dept_ids = [dept_ids] if dept_ids else None
                    elif dept_ids is None:
                        dept_ids = None
                    elif not isinstance(dept_ids, list):
                        dept_ids = [dept_ids] if dept_ids else None

                    simulation_mapping[sid] = SimulationMappingItem(
                        name=sdata.get("name", ""),
                        description=sdata.get("description", ""),
                        time_limit=sdata.get("time_limit"),
                        department_ids=dept_ids,
                    )

        parameter_mapping: ParameterMapping = {}
        param_mapping_data = parse_jsonb(scenario.get("parameter_mapping"))
        if isinstance(param_mapping_data, dict):
            for pid, pdata in param_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[pid] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        numerical=pdata.get("numerical", False),
                        document_parameter=pdata.get("document_parameter", False),
                        persona_parameter=pdata.get("persona_parameter", False),
                        scenario_parameter=pdata.get("scenario_parameter", False),
                        video_parameter=pdata.get("video_parameter", False),
                    )

        field_mapping: FieldMapping = {}
        field_mapping_data = parse_jsonb(scenario.get("field_mapping"))
        if isinstance(field_mapping_data, dict):
            for piid, pidata in field_mapping_data.items():
                if isinstance(pidata, dict):
                    conditional_parameter_ids = pidata.get("conditional_parameter_ids")
                    field_mapping[piid] = FieldMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                        conditional_parameter_ids=[
                            str(cp) for cp in conditional_parameter_ids
                        ]
                        if isinstance(conditional_parameter_ids, list)
                        else None,
                    )

        department_mapping: DepartmentMapping = {}
        dept_mapping_data = parse_jsonb(scenario.get("department_mapping"))
        if isinstance(dept_mapping_data, dict):
            for did, ddata in dept_mapping_data.items():
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

        problem_statement_mapping: dict[str, ProblemStatementInfo] = {}
        ps_mapping_data = parse_jsonb(scenario.get("problem_statement_mapping"))
        if isinstance(ps_mapping_data, dict):
            for psid, psdata in ps_mapping_data.items():
                if isinstance(psdata, dict):
                    problem_statement_mapping[psid] = ProblemStatementInfo(
                        problem_statement=psdata.get("problem_statement", ""),
                        created_at=psdata.get("created_at", ""),
                        updated_at=psdata.get("updated_at", ""),
                    )

        objectives_history: list[ObjectiveWithDepartments] = []
        obj_history_data = parse_jsonb(scenario.get("objectives_history"))
        if isinstance(obj_history_data, list):
            for obj_data in obj_history_data:
                if isinstance(obj_data, dict):
                    objectives_history.append(
                        ObjectiveWithDepartments(
                            objective=obj_data.get("objective", ""),
                            department_ids=obj_data.get("department_ids", []) or [],
                        )
                    )

        document_details: list[DocumentDetailItem] = []
        doc_details_data = parse_jsonb(scenario.get("document_details"))
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
                        )
                    )

        # Derive document_ids from document_details
        document_ids = [doc.document_id for doc in document_details if doc.document_id]

        # Compute permissions
        in_use_by_active = scenario["active_usage_count"] > 0
        is_generated = scenario["generated"]
        is_superadmin = scenario["user_role"] == "superadmin"
        department_ids = scenario.get("department_ids")
        has_department_links = department_ids and len(department_ids) > 0
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

        # Parse department_ids
        department_ids = scenario.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        # Parse other arrays
        objective_ids = scenario["objective_ids"] or []
        active_simulation_ids = scenario["simulation_ids"] or []
        valid_persona_ids = scenario["valid_persona_ids"] or []
        valid_document_ids = scenario["valid_document_ids"] or []
        dept_ids_raw = scenario["valid_department_ids"] or []
        dept_ids = [str(did) for did in dept_ids_raw]

        # Parse scenario_images from JSONB
        scenario_images_data = parse_jsonb(scenario.get("scenario_images"))
        scenario_images: list[dict[str, Any]] = []
        if isinstance(scenario_images_data, list):
            scenario_images = [
                {
                    "id": img.get("id", ""),
                    "name": img.get("name", ""),
                    "file_path": img.get("file_path", ""),
                    "mime_type": img.get("mime_type", ""),
                    "active": img.get("active", True),
                }
                for img in scenario_images_data
                if isinstance(img, dict)
            ]

        # Parse agent_mapping
        agent_mapping: AgentMapping = {}
        agent_mapping_data = parse_jsonb(scenario.get("agent_mapping"))
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

        valid_agent_ids = [str(aid) for aid in (scenario.get("valid_agent_ids") or [])]

        # Parse scenario_parameter_ids and valid_parameter_ids
        scenario_parameter_ids = scenario.get("parameter_ids") or []
        if not isinstance(scenario_parameter_ids, list):
            scenario_parameter_ids = []
        scenario_parameter_ids = [str(pid) for pid in scenario_parameter_ids]

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

        # Always compute filtered_valid_general_field_ids if randomize is present
        # (needed for randomization even when no filter params are provided)
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
        elif request_data.randomize:
            # When randomize is present but no filter params, still need filtered_valid_general_field_ids
            # Initialize with base values (no filtering applied)
            mapping_ids = list(
                field_mapping.keys()
            )  # Renamed from param_item_full_mapping
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
                field_mapping=field_mapping,  # Renamed from param_item_full_mapping
                document_details=document_details,
            )

        # Compute allowed ranges from filtered IDs (cap max at 5)
        max_valid_personas = min(5, len(filtered_valid_persona_ids))
        max_valid_documents = min(5, len(filtered_valid_document_ids))
        max_valid_parameters = min(5, len(valid_parameter_ids))

        # Default ranges
        persona_min = (
            request_data.personaMin if request_data.personaMin is not None else 1
        )
        persona_max = min(
            request_data.personaMax if request_data.personaMax is not None else 2,
            max_valid_personas,
        )
        document_min = (
            request_data.documentMin if request_data.documentMin is not None else 0
        )
        document_max = min(
            request_data.documentMax if request_data.documentMax is not None else 2,
            max_valid_documents,
        )
        parameter_selection_min = (
            request_data.parameterSelectionMin
            if request_data.parameterSelectionMin is not None
            else 0
        )
        parameter_selection_max = min(
            request_data.parameterSelectionMax
            if request_data.parameterSelectionMax is not None
            else 5,
            max_valid_parameters,
        )

        # Per-parameter field ranges
        field_ranges_dict: dict[
            str, dict[str, int]
        ] = {}  # Renamed from parameter_items_ranges
        if (
            filtered_valid_general_field_ids
        ):  # Renamed from filtered_valid_general_parameter_item_ids
            for param_id in parameter_mapping.keys():
                valid_items_for_param = [
                    item_id
                    for item_id in filtered_valid_general_field_ids  # Renamed from filtered_valid_general_parameter_item_ids
                    if item_id in field_mapping  # Renamed from param_item_full_mapping
                    and field_mapping[item_id].parameter_id == param_id
                ]
                max_valid_items = min(5, len(valid_items_for_param))

                if (
                    request_data.fieldRanges and param_id in request_data.fieldRanges
                ):  # Renamed from parameterItemRanges
                    param_range = request_data.fieldRanges[param_id]
                    param_min = param_range.get("min", 1)
                    param_max = min(param_range.get("max", 2), max_valid_items)
                else:
                    param_min = 1
                    param_max = min(2, max_valid_items)

                field_ranges_dict[param_id] = {
                    "min": param_min,
                    "max": param_max,
                }  # Renamed from parameter_items_ranges

        allowed_ranges = AllowedRanges(
            persona=RangeMinMax(min=persona_min, max=persona_max),
            document=RangeMinMax(min=document_min, max=document_max),
            parameter_selection=RangeMinMax(
                min=parameter_selection_min,
                max=parameter_selection_max,
            ),
            fields={  # Renamed from parameter_items
                param_id: RangeMinMax(min=range_dict["min"], max=range_dict["max"])
                for param_id, range_dict in field_ranges_dict.items()  # Renamed from parameter_items_ranges
            },
        )

        # Handle randomization if requested
        import random

        randomized_persona_ids: list[str] | None = None
        randomized_document_ids: list[str] | None = None
        randomized_parameter_ids: list[str] | None = None
        randomized_field_ids: list[str] | None = (
            None  # Renamed from randomized_parameter_item_ids
        )

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
                # Only randomize items for parameters that were randomized (or selected if no randomization)
                if (
                    filtered_valid_general_field_ids
                ):  # Renamed from filtered_valid_general_parameter_item_ids
                    randomized_items: list[str] = []
                    # Use randomized parameter IDs if available, otherwise use selected parameter IDs
                    params_to_randomize = (
                        randomized_parameter_ids
                        if randomized_parameter_ids
                        else (request_data.parameterIds or [])
                    )
                    for param_id in params_to_randomize:
                        if (
                            param_id in field_ranges_dict
                        ):  # Renamed from parameter_items_ranges
                            param_range = field_ranges_dict[param_id]
                            try:
                                min_val = param_range["min"]
                                max_val = param_range["max"]
                                valid_items_for_param = [
                                    item_id
                                    for item_id in filtered_valid_general_field_ids  # Renamed from filtered_valid_general_parameter_item_ids
                                    if item_id
                                    in field_mapping  # Renamed from param_item_full_mapping
                                    and field_mapping[item_id].parameter_id == param_id
                                ]
                                if valid_items_for_param:
                                    max_valid_items = min(5, len(valid_items_for_param))
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
                        randomized_field_ids = randomized_items  # Renamed from randomized_parameter_item_ids

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
                # Randomize fields for specific parameter (format: "parameter_{field_id}")
                param_id = randomize_value.replace("parameter_", "")
                if (
                    filtered_valid_general_field_ids and param_id in field_ranges_dict
                ):  # Renamed from filtered_valid_general_parameter_item_ids and parameter_items_ranges
                    param_range = field_ranges_dict[param_id]
                    try:
                        min_val = param_range["min"]
                        max_val = param_range["max"]
                        valid_items_for_param = [
                            item_id
                            for item_id in filtered_valid_general_field_ids  # Renamed from filtered_valid_general_parameter_item_ids
                            if item_id
                            in field_mapping  # Renamed from param_item_full_mapping
                            and field_mapping[item_id].parameter_id == param_id
                        ]
                        if valid_items_for_param:
                            max_valid_items = min(5, len(valid_items_for_param))
                            capped_max = min(max_val, max_valid_items)
                            count = min(
                                capped_max,
                                max(min_val, random.randint(min_val, capped_max)),
                            )
                            shuffled = valid_items_for_param.copy()
                            random.shuffle(shuffled)
                            randomized_field_ids = shuffled[
                                :count
                            ]  # Renamed from randomized_parameter_item_ids
                    except (ValueError, IndexError):
                        pass

        if (
            randomized_persona_ids is not None
            or randomized_document_ids is not None
            or randomized_parameter_ids is not None
            or randomized_field_ids
            is not None  # Renamed from randomized_parameter_item_ids
        ):
            randomized_selections = RandomizedSelections(
                personaIds=randomized_persona_ids,
                documentIds=randomized_document_ids,
                parameterIds=randomized_parameter_ids,
                fieldIds=randomized_field_ids,  # Renamed from parameterItemIds
            )

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

        response_data = ScenarioDetailResponse(
            name=scenario["name"],
            problem_statement=scenario["problem_statement"],
            problem_statement_id=scenario.get("problem_statement_id"),
            active=scenario["active"],
            generated=is_generated,
            documents_enabled=scenario.get(
                "documents_enabled", scenario.get("use_documents", False)
            ),  # Backward compatibility
            document_vision_enabled=scenario.get("document_vision_enabled", False),
            objectives_enabled=scenario.get("objectives_enabled", True),
            image_enabled=scenario.get("image_enabled", False),
            parent_scenario_id=scenario["parent_scenario_id"],
            department_ids=department_ids,
            valid_department_ids=dept_ids,
            persona_ids=persona_ids,
            valid_persona_ids=filtered_valid_persona_ids,
            document_ids=document_ids,
            valid_document_ids=filtered_valid_document_ids,
            valid_field_ids=filtered_valid_field_ids,  # Renamed from valid_parameter_item_ids
            valid_general_field_ids=filtered_valid_general_field_ids,  # Renamed from valid_general_parameter_item_ids
            allowed_ranges=allowed_ranges,
            # Objective count range (default: min=0, max=5)
            objective_count_range=RangeMinMax(min=0, max=5),
            randomized_selections=randomized_selections,
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
            scenario_parameter_ids=scenario_parameter_ids,
            valid_parameter_ids=valid_parameter_ids,
            scenario_agent_id=scenario.get("scenario_agent_id", ""),
            image_agent_id=scenario.get("image_agent_id", ""),
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
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
