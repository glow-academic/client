"""Simulation detail-default endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (DepartmentMapping, DepartmentMappingItem,
                              ParameterItemMapping, ParameterItemMappingItem,
                              ParameterMapping, ParameterMappingItem,
                              RubricMapping, RubricMappingItem,
                              ScenarioMapping, ScenarioMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline schemas
class ScenarioInSimulation(BaseModel):
    """Scenario with position in simulation."""

    scenario_id: str
    title: str
    description: str
    active: bool
    position: int  # From simulation_scenarios junction table
    parameter_item_ids: list[str]  # For displaying badges

    # Statistics fields
    usage_count: int  # Number of all chats (regardless of completion)
    success_rate: int  # Percentage (0-100) of completed chats that passed
    last_used: str | None  # ISO timestamp or None
    can_remove: bool  # True if usage_count == 0


class ParameterItem(BaseModel):
    """Parameter data for dropdown."""

    id: str
    parameter_id: str
    name: str
    description: str | None


class ParameterItemDetail(BaseModel):
    """Full parameter item details."""

    id: str
    name: str
    description: str | None
    parameter_id: str


# Inline request/response schemas
class SimulationDetailDefaultRequest(BaseModel):
    """Request to get default simulation details."""

    profileId: str


class SimulationDetailResponse(BaseModel):
    """Response for simulation detail endpoint."""

    # Basic fields
    name: str
    description: str
    department_ids: list[str] | None
    valid_department_ids: list[str]
    time_limit: int | None
    rubric_id: str
    valid_rubric_ids: list[str]
    scenario_ids: list[str]
    valid_scenario_ids: list[str]

    # Boolean parameters
    active: bool
    practice_simulation: bool

    # Permission flags
    can_edit: bool
    can_duplicate: bool
    can_delete: bool

    # Usage status
    in_use: bool
    cohort_count: int

    # Full scenario objects
    scenarios: list[ScenarioInSimulation]

    # Parameter data
    parameters: list[ParameterItem]
    parameter_items: list[ParameterItemDetail]
    parameter_mapping: ParameterMapping

    # Top-level mappings
    scenario_mapping: ScenarioMapping
    rubric_mapping: RubricMapping
    department_mapping: DepartmentMapping
    parameter_item_mapping: ParameterItemMapping


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            parsed: Any = json.loads(data)  # type: ignore[assignment, no-any-return]
            if isinstance(parsed, dict):
                return cast(dict[str, Any], parsed)  # type: ignore[return-value]  # mypy doesn't narrow Any properly
            if isinstance(parsed, list):
                return cast(list[Any], parsed)  # type: ignore[redundant-cast]  # mypy doesn't narrow Any properly
            return {}
        except json.JSONDecodeError:
            return {}
    if isinstance(data, dict):
        return cast(dict[str, Any], data)
    if isinstance(data, list):
        return data
    return None


@router.post("/detail-default", response_model=SimulationDetailResponse)
async def get_simulation_detail_default(
    request_data: SimulationDetailDefaultRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationDetailResponse:
    """Get default simulation details based on profile."""
    tags = ["simulations"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SimulationDetailResponse.model_validate(cached["data"])
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/simulations/get_simulation_detail_default_complete.sql")
        sql_params = (request_data.profileId,)

        # Execute query
        result = await conn.fetchrow(sql_query, request_data.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail="No simulations found for user's departments"
            )

        # Extract user role and cohort counts for permissions
        user_role = result.get("user_role", "trainee")
        active_cohort_count = result.get("active_cohort_count", 0)
        total_cohort_links = result.get("total_cohort_links", 0)
        practice_simulation = result.get("practice_simulation", False)

        # Compute permissions (matching list_simulations.sql logic)
        is_admin = user_role in ("admin", "instructional", "superadmin")
        # Can't edit if has active cohorts
        can_edit = is_admin and active_cohort_count == 0
        can_duplicate = is_admin
        # Can't delete if practice OR has any cohort links OR not admin
        can_delete = is_admin and not practice_simulation and total_cohort_links == 0

        # Parse scenarios list from JSONB
        scenarios_list: list[ScenarioInSimulation] = []
        scenarios_list_data = result.get("scenarios_list")
        if isinstance(scenarios_list_data, str):
            scenarios_list_data = json.loads(scenarios_list_data)
        if scenarios_list_data and isinstance(scenarios_list_data, list):
            for s_data in scenarios_list_data:
                if isinstance(s_data, dict):
                    scenarios_list.append(
                        ScenarioInSimulation(
                            scenario_id=s_data.get("scenario_id", ""),
                            title=s_data.get("title", ""),
                            description=s_data.get("description", ""),
                            active=s_data.get("active", True),
                            position=s_data.get("position", 0),
                            parameter_item_ids=s_data.get("parameter_item_ids", []),
                            usage_count=s_data.get("usage_count", 0),
                            success_rate=s_data.get("success_rate", 0),
                            last_used=s_data.get("last_used"),
                            can_remove=s_data.get("can_remove", True),
                        )
                    )

        # Get IDs
        scenario_ids = result.get("scenario_ids", [])
        valid_scenario_ids = result.get("valid_scenario_ids", [])
        valid_rubric_ids = result.get("valid_rubric_ids", [])
        valid_department_ids = result.get("valid_department_ids", [])

        # Parse rubric mapping
        rubric_mapping: RubricMapping = {}
        rubric_mapping_data = parse_jsonb(result.get("rubric_mapping"))
        if isinstance(rubric_mapping_data, dict):
            for rid, rdata in rubric_mapping_data.items():
                if isinstance(rdata, dict):
                    rubric_mapping[rid] = RubricMappingItem(
                        name=rdata.get("name", ""),
                        description=rdata.get("description", ""),
                    )

        # Parse scenario mapping (same logic as detail.py)
        scenario_mapping: ScenarioMapping = {}
        scenario_mapping_data = parse_jsonb(result.get("scenario_mapping"))
        if isinstance(scenario_mapping_data, dict):
            for sid, sdata in scenario_mapping_data.items():
                if isinstance(sdata, dict):
                    # Parse nested mappings
                    persona_mapping = {}
                    if sdata.get("persona_mapping") and isinstance(
                        sdata["persona_mapping"], dict
                    ):
                        from app.utils.schema import PersonaMappingItem

                        for pid, pdata in sdata["persona_mapping"].items():
                            if isinstance(pdata, dict):
                                persona_mapping[pid] = PersonaMappingItem(
                                    name=pdata.get("name", ""),
                                    description=pdata.get("description", ""),
                                    color=pdata.get("color", ""),
                                    icon=pdata.get("icon", ""),
                                    image_model=pdata.get("image_model", False),
                                )

                    document_mapping = {}
                    if sdata.get("document_mapping") and isinstance(
                        sdata["document_mapping"], dict
                    ):
                        from app.utils.schema import DocumentMappingItem

                        for did, ddata in sdata["document_mapping"].items():
                            if isinstance(ddata, dict):
                                document_mapping[did] = DocumentMappingItem(
                                    name=ddata.get("name", ""),
                                    description=ddata.get("description", ""),
                                )

                    param_item_mapping = {}
                    if sdata.get("parameter_item_mapping") and isinstance(
                        sdata["parameter_item_mapping"], dict
                    ):
                        for piid, pidata in sdata["parameter_item_mapping"].items():
                            if isinstance(pidata, dict):
                                param_item_mapping[piid] = ParameterItemMappingItem(
                                    name=pidata.get("name", ""),
                                    description=pidata.get("description", ""),
                                    parameter_id=pidata.get("parameter_id", ""),
                                    parameter_name=pidata.get("parameter_name", ""),
                                    value=pidata.get("value", ""),
                                )

                    persona_ids = []
                    if sdata.get("persona_ids"):
                        persona_ids = (
                            sdata["persona_ids"]
                            if isinstance(sdata["persona_ids"], list)
                            else [sdata["persona_ids"]]
                        )
                    elif sdata.get("persona_id"):
                        persona_ids = [str(sdata["persona_id"])]

                    scenario_mapping[sid] = ScenarioMappingItem(
                        name=sdata.get("name", ""),
                        description=sdata.get("description", ""),
                        persona_ids=persona_ids,
                        persona_mapping=persona_mapping,
                        document_mapping=document_mapping,
                        parameter_item_mapping=param_item_mapping,
                        parameter_item_ids=sdata.get("parameter_item_ids", []),
                        document_ids=sdata.get("document_ids", []),
                    )

        # Parse department mapping
        department_mapping: DepartmentMapping = {}
        department_mapping_data = parse_jsonb(result.get("department_mapping"))
        if isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):

                    def to_str_list(value: Any) -> list[str] | None:
                        if value is None:
                            return None
                        if isinstance(value, list):
                            return [str(v) for v in value if v]
                        return None

                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        scenario_ids=to_str_list(ddata.get("scenario_ids")),
                        rubric_ids=to_str_list(ddata.get("rubric_ids")),
                        cohort_ids=to_str_list(ddata.get("cohort_ids")),
                    )

        # Parse parameter mapping
        parameter_mapping: ParameterMapping = {}
        parameter_mapping_data = parse_jsonb(result.get("parameter_mapping"))
        if isinstance(parameter_mapping_data, dict):
            for pid, pdata in parameter_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[pid] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        numerical=pdata.get("numerical", False),
                        document_parameter=pdata.get("document_parameter", False),
                    )

        # Parse parameter_item mapping
        parameter_item_mapping: ParameterItemMapping = {}
        parameter_item_mapping_data = parse_jsonb(result.get("parameter_item_mapping"))
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

        # Parse parameter items list
        parameters_list: list[ParameterItem] = []
        parameter_items_list: list[ParameterItemDetail] = []
        parameter_items_list_data = parse_jsonb(result.get("parameter_items_list"))
        if isinstance(parameter_items_list_data, list):
            for pi_data in parameter_items_list_data:
                if isinstance(pi_data, dict):
                    parameter_items_list.append(
                        ParameterItemDetail(
                            id=pi_data.get("id", ""),
                            name=pi_data.get("name", ""),
                            description=pi_data.get("description"),
                            parameter_id=pi_data.get("parameter_id", ""),
                        )
                    )
                    parameters_list.append(
                        ParameterItem(
                            id=pi_data.get("id", ""),
                            parameter_id=pi_data.get("parameter_id", ""),
                            name=pi_data.get("name", ""),
                            description=pi_data.get("description"),
                        )
                    )

        # Parse department_ids
        department_ids = result.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        response_data = SimulationDetailResponse(
            name=result.get("title", ""),
            description=result.get("description", ""),
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            time_limit=result.get("time_limit"),
            rubric_id=str(result.get("rubric_id", "")) if result.get("rubric_id") else "",
            valid_rubric_ids=valid_rubric_ids,
            scenario_ids=scenario_ids,
            valid_scenario_ids=valid_scenario_ids,
            active=result.get("active", False),
            practice_simulation=result.get("practice_simulation", False),
            can_edit=can_edit,
            can_duplicate=can_duplicate,
            can_delete=can_delete,
            in_use=total_cohort_links > 0,  # In use if has any cohort links
            cohort_count=total_cohort_links,  # Return total for display
            scenarios=scenarios_list,
            parameters=parameters_list,
            parameter_items=parameter_items_list,
            parameter_mapping=parameter_mapping,
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
            department_mapping=department_mapping,
            parameter_item_mapping=parameter_item_mapping,
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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulation_detail_default",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

