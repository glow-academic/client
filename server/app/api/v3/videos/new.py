"""Video new endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (AgentMapping, AgentMappingItem,
                              DepartmentMapping, DepartmentMappingItem,
                              DocumentMapping, FieldMapping, ParameterMapping,
                              PersonaMapping, PersonaMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


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
    department_mapping: DepartmentMapping,
    document_mapping: DocumentMapping,
    field_mapping: FieldMapping,
    parameter_mapping: ParameterMapping,
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

        dept_filtered_ids = preserve_order_union_selected_first(
            selected_doc_ids, filtered
        )

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
    # BUT: Only filter by fields that belong to document parameters
    # Filter out non-document-parameter fields from selected_field_ids
    document_parameter_field_ids = []
    if selected_field_ids:
        for field_id in selected_field_ids:
            if not field_id:
                continue
            field = field_mapping.get(field_id)
            if not field or not field.parameter_id:
                continue
            # Only include fields that belong to document parameters
            param = parameter_mapping.get(field.parameter_id)
            if param and param.document_parameter:
                document_parameter_field_ids.append(field_id)
    
    # Only apply field-based filtering if we have document parameter fields
    if len(document_parameter_field_ids) == 0:
        return preserve_order_union_selected_first(selected_doc_ids, param_filtered)

    selected_doc_ids_for_filter = set(selected_doc_ids)
    filtered_result = []

    for doc_id in param_filtered:
        if doc_id in selected_doc_ids_for_filter:
            continue

        doc_mapping_item = document_mapping.get(doc_id)
        doc_field_ids: list[str] = []
        if doc_mapping_item and doc_mapping_item.field_ids:
            doc_field_ids = doc_mapping_item.field_ids

        # If document has no fields at all, and we have selected document parameter fields, filter it out
        if len(doc_field_ids) == 0 and len(document_parameter_field_ids) > 0:
            continue

        doc_field_set = set(doc_field_ids)

        # Check each selected document parameter field: document must have the exact selected field
        has_all_fields = True
        for selected_field_id in document_parameter_field_ids:
            if not selected_field_id:
                continue

            selected_field = field_mapping.get(selected_field_id)
            if not selected_field or not selected_field.parameter_id:
                continue

            if selected_field_id not in doc_field_set:
                has_all_fields = False
                break

        if has_all_fields:
            filtered_result.append(doc_id)

    return preserve_order_union_selected_first(selected_doc_ids, filtered_result)


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
        if dept_data.field_ids is not None:
            all_dept_field_ids.update(dept_data.field_ids)

    selected_dept_field_ids: set[str] = set()
    for dept_id in selected_dept_ids:
        dept_data = department_mapping.get(dept_id)
        if dept_data and dept_data.field_ids is not None:
            selected_dept_field_ids.update(dept_data.field_ids)

    filtered = [
        item_id
        for item_id in mapping_ids
        if item_id in selected_dept_field_ids or item_id not in all_dept_field_ids
    ]

    return preserve_order_union_selected_first(selected_field_ids, filtered)


def filter_valid_general_field_ids(
    valid_field_ids: list[str],
    selected_param_ids: list[str] | None,
    selected_persona_ids: list[str] | None,
    selected_doc_ids: list[str] | None,
    selected_field_ids: list[str] | None,
    persona_mapping: PersonaMapping,
    document_mapping: DocumentMapping,
    field_mapping: FieldMapping,
) -> list[str]:
    """Filter valid general field IDs based on personas/documents/parameters."""
    if selected_param_ids is None:
        selected_param_ids = []
    if selected_persona_ids is None:
        selected_persona_ids = []
    if selected_doc_ids is None:
        selected_doc_ids = []
    if selected_field_ids is None:
        selected_field_ids = []

    if (
        len(selected_param_ids) == 0
        and len(selected_persona_ids) == 0
        and len(selected_doc_ids) == 0
    ):
        return preserve_order_union_selected_first(selected_field_ids, valid_field_ids)

    filtered_result: list[str] = []
    selected_field_id_set = set(selected_field_ids)

    for item_id in valid_field_ids:
        if item_id in selected_field_id_set:
            filtered_result.append(item_id)
            continue

        item = field_mapping.get(item_id)
        if not item:
            continue

        param_id = item.parameter_id

        if len(selected_param_ids) > 0 and param_id not in selected_param_ids:
            continue

        if len(selected_persona_ids) > 0:
            has_matching_persona = False
            for persona_id in selected_persona_ids:
                persona = persona_mapping.get(persona_id)
                if persona and persona.field_ids and item_id in persona.field_ids:
                    has_matching_persona = True
                    break
            if not has_matching_persona:
                continue

        if len(selected_doc_ids) > 0:
            has_matching_doc = False
            for doc_id in selected_doc_ids:
                doc = document_mapping.get(doc_id)
                if doc and doc.field_ids and item_id in doc.field_ids:
                    has_matching_doc = True
                    break
            if not has_matching_doc:
                continue

        filtered_result.append(item_id)

    return preserve_order_union_selected_first(selected_field_ids, filtered_result)


# Inline request/response schemas
class VideoNewRequest(BaseModel):
    """Request to get default video details."""

    profileId: str
    # Filter parameters (optional)
    departmentIds: list[str] | None = None
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
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


# Import shared types from detail.py to avoid duplication
# Note: These are duplicated here to keep endpoints independent (DHH style)
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


class ProblemStatementInfo(BaseModel):
    """Problem statement info for mapping."""

    problem_statement: str
    created_at: str
    updated_at: str


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
    file_path: str
    mime_type: str
    video_url: str | None
    department_ids: list[str] | None
    valid_department_ids: list[str]
    outline_ids: list[str]
    outline_mapping: dict[str, dict[str, str]]
    problem_statement_ids: list[str]
    problem_statement_mapping: dict[str, ProblemStatementInfo]
    objective_ids: list[str]
    objective_mapping: dict[str, dict[str, str]]
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
    questions: list[QuestionResponse]  # Empty for default
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
    # Selected IDs from request (filtered to valid ones) - server-driven approach
    selected_persona_ids: list[str] | None = None
    selected_document_ids: list[str] | None = None
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


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            return json.loads(data)  # type: ignore
        except json.JSONDecodeError:
            return {}
    return data or {}


@router.post("/new", response_model=VideoDetailResponse)
async def get_video_new(
    request_data: VideoNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> VideoDetailResponse:
    """Get default video structure for creation mode."""
    tags = ["videos"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return VideoDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL query
        sql_query = load_sql("sql/v3/videos/get_video_new_complete.sql")
        sql_params = (request_data.profileId,)

        # Execute query
        result = await conn.fetchrow(sql_query, request_data.profileId)

        if not result:
            raise ValueError("Failed to fetch default video data")

        dept_ids = result["department_ids"] or []

        if not dept_ids:
            raise ValueError("No accessible departments found for user")

        # Parse department_mapping from JSONB
        department_mapping_data = parse_jsonb(result.get("department_mapping"))
        department_mapping: DepartmentMapping = {}
        if isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse problem_statement_mapping from JSONB
        problem_statement_mapping_data = parse_jsonb(
            result.get("problem_statement_mapping")
        )
        problem_statement_mapping: dict[str, ProblemStatementInfo] = {}
        if isinstance(problem_statement_mapping_data, dict):
            for k, v in problem_statement_mapping_data.items():
                if isinstance(v, dict):
                    problem_statement_mapping[k] = ProblemStatementInfo(
                        problem_statement=v.get("problem_statement", ""),
                        created_at=v.get("created_at", ""),
                        updated_at=v.get("updated_at", ""),
                    )

        # Parse document_mapping from JSONB
        from app.utils.schema import DocumentMappingItem

        document_mapping_data = parse_jsonb(result.get("document_mapping"))
        document_mapping: DocumentMapping = {}
        document_mapping_dict: dict[str, dict[str, str]] = {}
        if isinstance(document_mapping_data, dict):
            for k, v in document_mapping_data.items():
                if isinstance(v, dict):
                    parameter_ids = v.get("parameter_ids", [])
                    field_ids = v.get("field_ids", [])
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
                        "parent_document_id": v.get("parent_document_id"),
                    }
                    parent_document_id = v.get("parent_document_id")
                    document_mapping[k] = DocumentMappingItem(
                        name=v.get("name", ""),
                        description=v.get("description", ""),
                        file_path=v.get("filePath", ""),
                        mime_type=v.get("mimeType", ""),
                        parameter_ids=v.get("parameter_ids", []),
                        field_ids=v.get("field_ids", []),
                        parent_document_id=str(parent_document_id)
                        if parent_document_id
                        else None,
                    )

        # Parse valid_document_ids
        valid_document_ids = result.get("valid_document_ids") or []
        if not isinstance(valid_document_ids, list):
            valid_document_ids = []

        # Parse document_details from JSONB
        document_details: list[DocumentDetailItem] = []
        document_details_data = parse_jsonb(result.get("document_details"))
        if isinstance(document_details_data, list):
            for doc in document_details_data:
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

        # Parse objectives_history
        objectives_history = result.get("objectives_history") or []
        if not isinstance(objectives_history, list):
            objectives_history = []

        # Parse agent_mapping
        agent_mapping: AgentMapping = {}
        agent_mapping_data = parse_jsonb(result.get("agent_mapping"))
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

        valid_agent_ids = [str(aid) for aid in (result.get("valid_agent_ids") or [])]

        # Parse parameter_mapping from JSONB
        from app.utils.schema import ParameterMappingItem

        parameter_mapping_data = parse_jsonb(result.get("parameter_mapping"))
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
        from app.utils.schema import FieldMappingItem

        field_mapping_data = parse_jsonb(result.get("field_mapping"))
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
        parameter_item_ids = result.get("parameter_item_ids") or []
        if not isinstance(parameter_item_ids, list):
            parameter_item_ids = []
        parameter_item_ids = [str(pid) for pid in parameter_item_ids]

        # Parse persona_mapping from JSONB
        persona_mapping_data = parse_jsonb(result.get("persona_mapping"))
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
        valid_persona_ids = result.get("valid_persona_ids") or []
        if not isinstance(valid_persona_ids, list):
            valid_persona_ids = []
        valid_persona_ids = [str(pid) for pid in valid_persona_ids]

        # Get user role and primary department for default behavior
        user_role = str(result.get("user_role", "")).lower()
        is_superadmin = user_role == "superadmin"
        primary_department_id = result.get("primary_department_id")

        # Set default department_ids based on role
        # Superadmin: None (empty = all departments = default object)
        # Non-superadmin: [primaryDepartmentId] if available
        if is_superadmin:
            default_department_ids = None
        else:
            default_department_ids = (
                [primary_department_id] if primary_department_id else []
            )

        is_default = default_department_ids is None or len(default_department_ids) == 0

        # For default videos, only superadmin can edit
        can_edit_default = not (is_default and not is_superadmin)

        # Parse video_parameter_ids and valid_parameter_ids
        video_parameter_ids: list[str] = []  # Empty for new video
        valid_parameter_ids = list(parameter_mapping.keys())

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
                department_mapping=department_mapping,
                document_mapping=document_mapping,
                field_mapping=field_mapping,
                parameter_mapping=parameter_mapping,
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
            filtered_valid_general_field_ids = filter_valid_general_field_ids(
                valid_field_ids=filtered_valid_field_ids or mapping_ids,
                selected_param_ids=request_data.parameterIds,
                selected_persona_ids=request_data.personaIds,
                selected_doc_ids=request_data.documentIds,
                selected_field_ids=request_data.fieldIds,
                persona_mapping=persona_mapping,
                document_mapping=document_mapping,
                field_mapping=field_mapping,
            )
        elif request_data.randomize:
            # When randomize is present but no filter params, still need filtered_valid_general_field_ids
            mapping_ids = list(field_mapping.keys())
            filtered_valid_field_ids = mapping_ids
            filtered_valid_general_field_ids = filter_valid_general_field_ids(
                valid_field_ids=filtered_valid_field_ids,
                selected_param_ids=None,
                selected_persona_ids=None,
                selected_doc_ids=None,
                selected_field_ids=None,
                persona_mapping=persona_mapping,
                document_mapping=document_mapping,
                field_mapping=field_mapping,
            )

        # Fixed ranges (server is source of truth, not based on available items)
        # Personas: 1-3 (default max: 1)
        persona_min = (
            request_data.personaMin if request_data.personaMin is not None else 1
        )
        persona_max = (
            request_data.personaMax if request_data.personaMax is not None else 1
        )
        # Ensure max doesn't exceed fixed limit
        persona_max = min(persona_max, 3)
        # Ensure min doesn't exceed max
        persona_min = min(persona_min, persona_max)
        
        # Documents: 0-3 (default max: 1)
        document_min = (
            request_data.documentMin if request_data.documentMin is not None else 0
        )
        document_max = (
            request_data.documentMax if request_data.documentMax is not None else 1
        )
        # Ensure max doesn't exceed fixed limit
        document_max = min(document_max, 3)
        # Ensure min doesn't exceed max
        document_min = min(document_min, document_max)
        
        # Parameters: 0-3 (default max: 3)
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
        # Ensure max doesn't exceed fixed limit
        parameter_selection_max = min(parameter_selection_max, 3)
        # Ensure min doesn't exceed max
        parameter_selection_min = min(parameter_selection_min, parameter_selection_max)
        
        # For randomization, we still need to cap based on available items
        max_valid_personas = len(filtered_valid_persona_ids)
        max_valid_documents = len(filtered_valid_document_ids)
        max_valid_parameters = len(valid_parameter_ids)

        # Per-parameter field ranges
        # Always set default ranges for all parameters (fixed ranges, not based on available items)
        field_ranges_dict: dict[str, dict[str, int]] = {}
        for param_id in parameter_mapping.keys():
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

        allowed_ranges = AllowedRanges(
            persona=RangeMinMax(min=persona_min, max=persona_max),
            document=RangeMinMax(min=document_min, max=document_max),
            parameter_selection=RangeMinMax(
                min=parameter_selection_min,
                max=parameter_selection_max,
            ),
            fields={
                param_id: RangeMinMax(min=range_dict["min"], max=range_dict["max"])
                for param_id, range_dict in field_ranges_dict.items()
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
                if filtered_valid_general_field_ids:
                    randomized_items: list[str] = []
                    params_to_randomize = (
                        randomized_parameter_ids
                        if randomized_parameter_ids
                        else (request_data.parameterIds or [])
                    )
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
                                capped_max = min(max_val, len(valid_items_for_param))
                                count = min(
                                    capped_max,
                                    max(min_val, random.randint(min_val, capped_max)),
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

            if (
                randomized_persona_ids is not None
                or randomized_document_ids is not None
                or randomized_parameter_ids is not None
                or randomized_field_ids is not None
            ):
                randomized_selections = RandomizedSelections(
                    personaIds=randomized_persona_ids,
                    documentIds=randomized_document_ids,
                    parameterIds=randomized_parameter_ids,
                    fieldIds=randomized_field_ids,
                )

        response_data = VideoDetailResponse(
            # Basic fields (empty defaults)
            name="",
            length_seconds=8,  # Default to 8 seconds
            active=True,
            file_path="",
            mime_type="",
            video_url=None,
            # Department
            department_ids=default_department_ids,
            valid_department_ids=dept_ids,
            # Problem statement and objectives (empty for default)
            outline_ids=[],
            outline_mapping={},
            problem_statement_ids=[],
            problem_statement_mapping=problem_statement_mapping,
            objective_ids=[],
            objective_mapping={},
            # Policies (empty for default)
            document_ids=[],
            document_mapping=document_mapping_dict,
            document_details=document_details,
            valid_document_ids=filtered_valid_document_ids,
            # Video images (empty for default)
            video_images=[],
            # Objectives history
            objectives_history=[str(obj) for obj in objectives_history],
            # Permissions (check if default video and user role)
            can_edit=can_edit_default,
            can_duplicate=False,  # Can't duplicate non-existent video
            can_delete=False,  # Can't delete non-existent video
            # Mappings
            department_mapping=department_mapping,
            # Questions (empty for create mode)
            questions=[],
            # Agents (empty IDs for new video, but include mapping and valid IDs)
            outline_agent_id=result.get("outline_agent_id", "") or "",
            image_agent_id=result.get("image_agent_id", "") or "",
            video_agent_id=result.get("video_agent_id", "") or "",
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
            # Parameters (empty for new video)
            parameter_mapping=parameter_mapping,
            field_mapping=field_mapping,
            parameter_item_ids=parameter_item_ids,
            video_parameter_ids=video_parameter_ids,
            valid_parameter_ids=valid_parameter_ids,
            # Personas (empty for new video)
            persona_ids=[],
            persona_mapping=persona_mapping,
            valid_persona_ids=filtered_valid_persona_ids,
            valid_field_ids=filtered_valid_field_ids,
            valid_general_field_ids=filtered_valid_general_field_ids,
            allowed_ranges=allowed_ranges,
            # Calculate question count range based on default video length (8 seconds)
            question_count_range=RangeMinMax(min=0, max=3),  # floor(8/4)+1 = 3
            randomized_selections=randomized_selections,
            selected_persona_ids=request_data.personaIds,
            selected_document_ids=request_data.documentIds,
            selected_parameter_ids=request_data.parameterIds,
            selected_field_ids=request_data.fieldIds,
            persona_search=request_data.personaSearch,
            document_search=request_data.documentSearch,
            parameter_search=request_data.parameterSearch,
            persona_min=request_data.personaMin,
            persona_max=request_data.personaMax,
            document_min=request_data.documentMin,
            document_max=request_data.documentMax,
            parameter_selection_min=request_data.parameterSelectionMin,
            parameter_selection_max=request_data.parameterSelectionMax,
            field_ranges=request_data.fieldRanges,
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
            operation="get_video_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
