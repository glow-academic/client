"""Scenario new endpoint - v3 API following DHH principles."""

import json
from collections.abc import Sequence
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (DepartmentMapping, DepartmentMappingItem,
                              DocumentMapping, DocumentMappingItem,
                              ParameterItemMapping, ParameterItemMappingItem,
                              ParameterMapping, ParameterMappingItem,
                              PersonaMapping, PersonaMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class ScenarioNewRequest(BaseModel):
    """Request to get default scenario details."""

    profileId: str


class ParameterDetail(BaseModel):
    """Parameter detail structure."""

    parameter_item_ids: list[str]
    valid_parameter_item_ids: list[str]


class DocumentDetailItem(BaseModel):
    """Document detail for preview."""

    document_id: str
    name: str
    type: str
    updatedAt: str
    extension: str
    scenario_ids: list[str]
    can_edit: bool
    can_delete: bool
    active: bool
    department_ids: list[str] | None
    file_path: str
    mime_type: str
    parameter_item_ids: list[str]


class ObjectiveWithDepartments(BaseModel):
    """Objective with department IDs."""

    objective: str
    department_ids: list[str]


class ProblemStatementInfo(BaseModel):
    """Problem statement version info."""

    problem_statement: str
    created_at: str
    updated_at: str


class ScenarioDetailResponse(BaseModel):
    """Response for scenario detail."""

    name: str
    problem_statement: str
    problem_statement_id: str | None
    active: bool
    generated: bool
    hints_enabled: bool
    objectives_enabled: bool
    image_input_enabled: bool
    parent_scenario_id: str | None
    department_ids: list[str] | None
    valid_department_ids: list[str]
    persona_ids: list[str]
    valid_persona_ids: list[str]
    document_ids: list[str]
    valid_document_ids: list[str]
    objective_ids: list[str]
    valid_objectives: list[str]
    objectives_history: list[ObjectiveWithDepartments]
    parameters: dict[str, ParameterDetail]
    active_simulation_ids: list[str]
    document_details: list[DocumentDetailItem]
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    parameter_mapping: ParameterMapping
    parameter_item_mapping: ParameterItemMapping
    simulation_mapping: dict[str, Any]
    persona_mapping: PersonaMapping
    document_mapping: DocumentMapping
    objective_mapping: dict[str, Any]
    department_mapping: DepartmentMapping
    problem_statement_mapping: dict[str, ProblemStatementInfo]


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            return json.loads(data)  # type: ignore
        except json.JSONDecodeError:
            return {}
    return data or {}


@router.post("/new", response_model=ScenarioDetailResponse)
async def get_scenario_new(
    request_data: ScenarioNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioDetailResponse:
    """Get default scenario structure for creation mode."""
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
        # Load SQL query
        sql_query = load_sql(
            "sql/v3/scenarios/get_scenario_new_complete.sql"
        )
        sql_params = (request_data.profileId,)

        # Execute query
        result = await conn.fetchrow(sql_query, request_data.profileId)

        if not result:
            raise ValueError("Failed to fetch default scenario data")

        dept_ids = result["department_ids"] or []

        if not dept_ids:
            raise ValueError("No accessible departments found for user")

        # Default department (first accessible)
        default_dept_id = dept_ids[0]

        # Extract data from consolidated query result
        valid_persona_ids = result["valid_persona_ids"] or []
        valid_document_ids = result["valid_document_ids"] or []

        # Parse JSONB mappings (may be string or dict)
        persona_mapping_data = parse_jsonb(result.get("persona_mapping"))
        persona_mapping: PersonaMapping = {}
        if isinstance(persona_mapping_data, dict):
            for pid, pdata in persona_mapping_data.items():
                if isinstance(pdata, dict):
                    persona_mapping[pid] = PersonaMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        color=pdata.get("color", ""),
                        icon=pdata.get("icon", ""),
                        image_model=pdata.get("image_model", False),
                    )

        document_mapping_data = parse_jsonb(result.get("document_mapping"))
        document_mapping: DocumentMapping = {}
        if isinstance(document_mapping_data, dict):
            for did, ddata in document_mapping_data.items():
                if isinstance(ddata, dict):
                    document_mapping[did] = DocumentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

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
                    )

        parameter_item_mapping_data = parse_jsonb(result.get("parameter_item_mapping"))
        parameter_item_mapping: ParameterItemMapping = {}
        if isinstance(parameter_item_mapping_data, dict):
            for piid, pidata in parameter_item_mapping_data.items():
                if isinstance(pidata, dict):
                    parameter_item_mapping[piid] = ParameterItemMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                        value=pidata.get("value", ""),
                    )

        department_mapping_data = parse_jsonb(result.get("department_mapping"))
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
                        parameter_item_ids=to_str_list(ddata.get("parameter_item_ids")),
                    )

        # Parse JSONB problem statement mapping (empty for default)
        problem_statement_mapping: dict[str, ProblemStatementInfo] = {}
        ps_mapping_data = parse_jsonb(result.get("problem_statement_mapping"))
        if isinstance(ps_mapping_data, dict):
            for psid, psdata in ps_mapping_data.items():
                if isinstance(psdata, dict):
                    problem_statement_mapping[psid] = ProblemStatementInfo(
                        problem_statement=psdata.get("problem_statement", ""),
                        created_at=psdata.get("created_at", ""),
                        updated_at=psdata.get("updated_at", ""),
                    )

        # Parse objectives_history JSONB array (now with department_ids)
        objectives_history: list[ObjectiveWithDepartments] = []
        obj_history_data = parse_jsonb(result.get("objectives_history"))
        if isinstance(obj_history_data, list):
            for obj_data in obj_history_data:
                if isinstance(obj_data, dict):
                    objectives_history.append(
                        ObjectiveWithDepartments(
                            objective=obj_data.get("objective", ""),
                            department_ids=obj_data.get("department_ids", []) or [],
                        )
                    )
                elif isinstance(obj_data, str):
                    # Fallback for backward compatibility
                    objectives_history.append(
                        ObjectiveWithDepartments(
                            objective=obj_data,
                            department_ids=[],
                        )
                    )

        # Parse JSONB parameters into ParameterDetail dict
        parameters_dict: dict[str, ParameterDetail] = {}
        params_data = parse_jsonb(result.get("parameters_json"))
        if isinstance(params_data, dict):
            for param_id, param_detail in params_data.items():
                if isinstance(param_detail, dict):
                    param_item_ids = param_detail.get("parameter_item_ids", [])
                    valid_param_item_ids = param_detail.get(
                        "valid_parameter_item_ids", []
                    )

                    if not isinstance(param_item_ids, list):
                        param_item_ids = []
                    if not isinstance(valid_param_item_ids, list):
                        valid_param_item_ids = []

                    parameters_dict[param_id] = ParameterDetail(
                        parameter_item_ids=param_item_ids,
                        valid_parameter_item_ids=valid_param_item_ids,
                    )

        # Parse document_details from JSONB (empty array for create mode)
        document_details: list[DocumentDetailItem] = []
        doc_details_data = parse_jsonb(result.get("document_details"))
        if isinstance(doc_details_data, list):
            for doc in doc_details_data:
                if isinstance(doc, dict):
                    document_details.append(
                        DocumentDetailItem(
                            document_id=doc.get("document_id", ""),
                            name=doc.get("name", ""),
                            type=doc.get("type", ""),
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
                            file_path=doc.get("file_path", ""),
                            mime_type=doc.get("mime_type", ""),
                            parameter_item_ids=doc.get("parameter_item_ids", []),
                        )
                    )

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
            default_department_ids = [primary_department_id] if primary_department_id else []
        
        is_default = default_department_ids is None or len(default_department_ids) == 0
        
        # For default scenarios, only superadmin can edit
        can_edit_default = not (is_default and not is_superadmin)

        response_data = ScenarioDetailResponse(
            # Basic fields (empty defaults)
            name="",
            problem_statement="",
            problem_statement_id=None,
            active=True,
            generated=False,
            hints_enabled=False,
            objectives_enabled=True,
            image_input_enabled=False,
            parent_scenario_id=None,
            # Department
            department_ids=default_department_ids,
            valid_department_ids=dept_ids,
            # IDs (empty defaults)
            persona_ids=[],
            valid_persona_ids=valid_persona_ids,
            document_ids=[],
            valid_document_ids=valid_document_ids,
            # Objectives (empty defaults)
            objective_ids=[],
            valid_objectives=[],
            objectives_history=objectives_history,
            # Parameters (with valid options for creation)
            parameters=parameters_dict,
            # Simulations (empty defaults)
            active_simulation_ids=[],
            # Document details (empty for create mode)
            document_details=document_details,
            # Permissions (check if default scenario and user role)
            can_edit=can_edit_default,
            can_duplicate=False,  # Can't duplicate non-existent scenario
            can_delete=False,  # Can't delete non-existent scenario
            # Mappings
            parameter_mapping=parameter_mapping,
            parameter_item_mapping=parameter_item_mapping,
            simulation_mapping={},
            persona_mapping=persona_mapping,
            document_mapping=document_mapping,
            objective_mapping={},
            department_mapping=department_mapping,
            problem_statement_mapping=problem_statement_mapping,
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
            operation="get_scenario_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

