"""Scenario detail endpoint - v3 API following DHH principles."""

import json
from collections.abc import Sequence
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (AgentMapping, AgentMappingItem, DepartmentMapping, DepartmentMappingItem,
                              DocumentMapping, DocumentMappingItem,
                              ObjectiveMapping, ObjectiveMappingItem,
                              ParameterItemMapping, ParameterItemMappingItem,
                              ParameterMapping, ParameterMappingItem,
                              PersonaMapping, PersonaMappingItem,
                              SimulationMapping, SimulationMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class ScenarioDetailRequest(BaseModel):
    """Request to get scenario details."""

    scenarioId: str
    profileId: str


class ParameterDetail(BaseModel):
    """Parameter detail structure."""

    parameter_item_ids: list[str]
    valid_parameter_item_ids: list[str]


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
    parameter_item_ids: list[str]


class ProblemStatementInfo(BaseModel):
    """Problem statement information for version history."""

    problem_statement: str
    created_at: str
    updated_at: str


class ObjectiveWithDepartments(BaseModel):
    """Objective with associated department IDs."""

    objective: str
    department_ids: list[str]


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
    parameter_item_mapping: ParameterItemMapping
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


router = APIRouter()


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
        sql_params = (request_data.scenarioId, request_data.profileId)

        # Execute query
        scenario = await conn.fetchrow(
            sql_query, request_data.scenarioId, request_data.profileId
        )
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
                    persona_mapping[pid] = PersonaMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        color=pdata.get("color", ""),
                        icon=pdata.get("icon", ""),
                        image_model=pdata.get("image_model", False),
                    )

        document_mapping: DocumentMapping = {}
        doc_mapping_data = parse_jsonb(scenario.get("document_mapping"))
        if isinstance(doc_mapping_data, dict):
            for did, ddata in doc_mapping_data.items():
                if isinstance(ddata, dict):
                    document_mapping[did] = DocumentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        filePath=ddata.get("filePath"),
                        mimeType=ddata.get("mimeType"),
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

        param_item_full_mapping: ParameterItemMapping = {}
        param_item_mapping_data = parse_jsonb(scenario.get("parameter_item_mapping"))
        if isinstance(param_item_mapping_data, dict):
            for piid, pidata in param_item_mapping_data.items():
                if isinstance(pidata, dict):
                    param_item_full_mapping[piid] = ParameterItemMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                        value=pidata.get("value", ""),
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
                        parameter_item_ids=to_str_list(ddata.get("parameter_item_ids")),
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
                            parameter_item_ids=doc.get("parameter_item_ids", []),
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

        valid_agent_ids = [
            str(aid) for aid in (scenario.get("valid_agent_ids") or [])
        ]

        # Parse scenario_parameter_ids and valid_parameter_ids
        scenario_parameter_ids = scenario.get("parameter_ids") or []
        if not isinstance(scenario_parameter_ids, list):
            scenario_parameter_ids = []
        scenario_parameter_ids = [str(pid) for pid in scenario_parameter_ids]

        # valid_parameter_ids are all keys in parameter_mapping
        valid_parameter_ids = list(parameter_mapping.keys())

        response_data = ScenarioDetailResponse(
            name=scenario["name"],
            problem_statement=scenario["problem_statement"],
            problem_statement_id=scenario.get("problem_statement_id"),
            active=scenario["active"],
            generated=is_generated,
            documents_enabled=scenario.get("documents_enabled", scenario.get("use_documents", False)),  # Backward compatibility
            document_vision_enabled=scenario.get("document_vision_enabled", False),
            objectives_enabled=scenario.get("objectives_enabled", True),
            image_enabled=scenario.get("image_enabled", False),
            parent_scenario_id=scenario["parent_scenario_id"],
            department_ids=department_ids,
            valid_department_ids=dept_ids,
            persona_ids=persona_ids,
            valid_persona_ids=valid_persona_ids,
            document_ids=document_ids,
            valid_document_ids=valid_document_ids,
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
            parameter_item_mapping=param_item_full_mapping,
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
