"""Simulation new endpoint - v3 API following DHH principles."""

from collections.abc import Sequence
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetSimulationNewApiRequest, GetSimulationNewApiResponse,
                           GetSimulationNewSqlParams, GetSimulationNewSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v3/simulations/get_simulation_new_complete.sql"


# Legacy response models for backward compatibility (will be removed after frontend update)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str
    scenario_ids: list[str] | None = None
    rubric_ids: list[str] | None = None
    cohort_ids: list[str] | None = None


class FieldMappingItem(BaseModel):
    """Field mapping item with parameter context."""

    name: str
    description: str
    parameter_id: str
    parameter_name: str


class ParameterMappingItem(BaseModel):
    """Parameter mapping item."""

    name: str
    description: str
    document_parameter: bool
    persona_parameter: bool


class RubricMappingItem(BaseModel):
    """Rubric mapping item."""

    name: str
    description: str


class PersonaMappingItem(BaseModel):
    """Persona mapping item with custom color and icon fields."""

    name: str
    description: str
    color: str
    icon: str
    image_model: bool | None = None


class DocumentMappingItem(BaseModel):
    """Document mapping item."""

    name: str
    description: str


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item with extended fields for nested data."""

    name: str
    description: str
    persona_ids: list[str]
    persona_mapping: dict[str, PersonaMappingItem]
    document_mapping: dict[str, DocumentMappingItem]
    parameter_item_mapping: dict[str, FieldMappingItem]
    parameter_item_ids: list[str]
    document_ids: list[str]


class AgentMappingItem(BaseModel):
    """Agent mapping item with role information."""

    name: str
    description: str
    roles: list[str] = []


class ScenarioInSimulation(BaseModel):
    """Scenario with position in simulation."""

    scenario_id: str
    title: str
    description: str
    active: bool
    position: int
    parameter_item_ids: list[str]
    hints_enabled: bool
    objectives_enabled: bool
    image_input_enabled: bool
    rubric_id: str | None
    time_limit_seconds: int | None
    usage_count: int
    success_rate: int
    last_used: str | None
    can_remove: bool
    has_active_video: bool


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


# Type aliases for Dict mappings
DepartmentMapping = dict[str, DepartmentMappingItem]
FieldMapping = dict[str, FieldMappingItem]
ParameterMapping = dict[str, ParameterMappingItem]
RubricMapping = dict[str, RubricMappingItem]
PersonaMapping = dict[str, PersonaMappingItem]
DocumentMapping = dict[str, DocumentMappingItem]
ScenarioMapping = dict[str, ScenarioMappingItem]
AgentMapping = dict[str, AgentMappingItem]


class SimulationNewRequest(BaseModel):
    """Request to get default simulation details."""

    pass


class SimulationDetailResponse(BaseModel):
    """Response for simulation detail endpoint."""

    name: str
    description: str
    department_ids: list[str] | None
    valid_department_ids: list[str]
    time_limit: int | None
    rubric_id: str
    valid_rubric_ids: list[str]
    scenario_ids: list[str]
    valid_scenario_ids: list[str]
    video_ids: list[str]
    valid_video_ids: list[str]
    active: bool
    practice_simulation: bool
    hint_agent_id: str | None
    grade_text_agent_id: str | None
    grade_voice_agent_id: str | None
    simulation_text_agent_id: str | None
    simulation_voice_agent_id: str | None
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    in_use: bool
    cohort_count: int
    scenarios: list[ScenarioInSimulation]
    videos: list[dict[str, Any]]
    parameters: list[ParameterItem]
    parameter_items: list[ParameterItemDetail]
    parameter_mapping: ParameterMapping
    scenario_mapping: dict[str, ScenarioMappingItem]
    video_mapping: dict[str, dict[str, Any]]
    rubric_mapping: dict[str, RubricMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    field_mapping: dict[str, FieldMappingItem]
    agent_mapping: dict[str, AgentMappingItem]
    valid_agent_ids: list[str]


router = APIRouter()


@router.post(
    "/new",
    response_model=SimulationDetailResponse,
    dependencies=[
        audit_activity("simulation.new", "{{ actor.name }} viewed new simulation form")
    ],
)
async def get_simulation_new(
    request_data: SimulationNewRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationDetailResponse:
    """Get default simulation details based on profile."""
    tags = ["simulations"]

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SimulationDetailResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params
        params = GetSimulationNewSqlParams(**request_data.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetSimulationNewSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert scenarios array to list (empty for new)
        scenarios_list: list[ScenarioInSimulation] = []
        if result.scenarios:
            for scenario in result.scenarios:
                scenarios_list.append(
                    ScenarioInSimulation(
                        scenario_id=str(scenario.scenario_id) if scenario.scenario_id else "",
                        title=scenario.title or "",
                        description=scenario.description or "",
                        active=scenario.active or True,
                        position=scenario.position or 0,
                        parameter_item_ids=[str(pid) for pid in (scenario.parameter_item_ids or [])],
                        hints_enabled=scenario.hints_enabled or False,
                        objectives_enabled=scenario.objectives_enabled or True,
                        image_input_enabled=scenario.image_input_enabled or False,
                        rubric_id=str(scenario.rubric_id) if scenario.rubric_id else None,
                        time_limit_seconds=scenario.time_limit_seconds,
                        usage_count=scenario.usage_count or 0,
                        success_rate=scenario.success_rate or 0,
                        last_used=scenario.last_used,
                        can_remove=scenario.can_remove or True,
                        has_active_video=scenario.has_active_video or False,
                    )
                )

        # Convert videos array to list
        videos_list: list[dict[str, Any]] = []
        if result.videos:
            for video in result.videos:
                videos_list.append({
                    "video_id": str(video.video_id) if video.video_id else "",
                    "name": video.name or "",
                    "description": video.description or "",
                    "length_seconds": video.length_seconds,
                })

        # Convert scenario_mapping array to dict
        scenario_mapping: ScenarioMapping = {}
        if result.scenarios_full:
            for scenario_full in result.scenarios_full:
                persona_mapping: PersonaMapping = {}
                if scenario_full.persona_mapping:
                    for persona in scenario_full.persona_mapping:
                        persona_mapping[str(persona.persona_id)] = PersonaMappingItem(
                            name=persona.name or "",
                            description=persona.description or "",
                            color=persona.color or "",
                            icon=persona.icon or "",
                            image_model=persona.image_model or False,
                        )

                document_mapping: DocumentMapping = {}
                if scenario_full.document_mapping:
                    for doc in scenario_full.document_mapping:
                        document_mapping[str(doc.document_id)] = DocumentMappingItem(
                            name=doc.name or "",
                            description=doc.description or "",
                        )

                field_mapping: FieldMapping = {}
                if scenario_full.parameter_item_mapping:
                    for field in scenario_full.parameter_item_mapping:
                        field_mapping[str(field.field_id)] = FieldMappingItem(
                            name=field.name or "",
                            description=field.description or "",
                            parameter_id=str(field.parameter_id) if field.parameter_id else "",
                            parameter_name=field.parameter_name or "",
                        )

                scenario_mapping[str(scenario_full.scenario_id)] = ScenarioMappingItem(
                    name=scenario_full.name or "",
                    description=scenario_full.description or "",
                    persona_ids=[str(pid) for pid in (scenario_full.persona_ids or [])],
                    persona_mapping=persona_mapping,
                    document_mapping=document_mapping,
                    parameter_item_mapping=field_mapping,
                    parameter_item_ids=[str(pid) for pid in (scenario_full.parameter_item_ids or [])],
                    document_ids=[str(did) for did in (scenario_full.document_ids or [])],
                )

        # Convert video_mapping array to dict
        video_mapping: dict[str, dict[str, Any]] = {}
        if result.videos:
            for video in result.videos:
                video_mapping[str(video.video_id)] = {
                    "name": video.name or "",
                    "description": video.description or "",
                    "length_seconds": video.length_seconds,
                }

        # Convert rubric_mapping array to dict
        rubric_mapping: RubricMapping = {}
        if result.rubrics:
            for rubric in result.rubrics:
                rubric_mapping[str(rubric.rubric_id)] = RubricMappingItem(
                    name=rubric.name or "",
                    description=rubric.description or "",
                )

        # Convert department_mapping array to dict
        department_mapping: DepartmentMapping = {}
        if result.departments:
            for dept in result.departments:
                def to_str_list(value: Sequence[Any] | None) -> list[str] | None:
                    if value is None:
                        return None
                    if isinstance(value, list):
                        return [str(v) for v in value if v]
                    return None

                department_mapping[str(dept.department_id)] = DepartmentMappingItem(
                    name=dept.name or "",
                    description=dept.description or "",
                    scenario_ids=to_str_list(dept.scenario_ids),
                    rubric_ids=to_str_list(dept.rubric_ids),
                    cohort_ids=to_str_list(dept.cohort_ids),
                )

        # Convert parameter_mapping array to dict
        parameter_mapping: ParameterMapping = {}
        if result.parameters_full:
            for param in result.parameters_full:
                parameter_mapping[str(param.parameter_id)] = ParameterMappingItem(
                    name=param.name or "",
                    description=param.description or "",
                    document_parameter=param.document_parameter or False,
                    persona_parameter=param.persona_parameter or False,
                )

        # Convert field_mapping array to dict
        field_mapping_dict: FieldMapping = {}
        if result.fields:
            for field in result.fields:
                field_mapping_dict[str(field.field_id)] = FieldMappingItem(
                    name=field.name or "",
                    description=field.description or "",
                    parameter_id=str(field.parameter_id) if field.parameter_id else "",
                    parameter_name=field.parameter_name or "",
                )

        # Convert parameter_items arrays to lists
        parameters_list: list[ParameterItem] = []
        parameter_items_list: list[ParameterItemDetail] = []
        if result.parameter_items:
            for pi in result.parameter_items:
                parameter_items_list.append(
                    ParameterItemDetail(
                        id=str(pi.id) if pi.id else "",
                        name=pi.name or "",
                        description=pi.description,
                        parameter_id=str(pi.parameter_id) if pi.parameter_id else "",
                    )
                )
        if result.parameters:
            for pi in result.parameters:
                parameters_list.append(
                    ParameterItem(
                        id=str(pi.id) if pi.id else "",
                        parameter_id=str(pi.parameter_id) if pi.parameter_id else "",
                        name=pi.name or "",
                        description=pi.description,
                    )
                )

        # Convert agent_mapping array to dict
        agent_mapping: AgentMapping = {}
        if result.agents:
            for agent in result.agents:
                agent_mapping[str(agent.agent_id)] = AgentMappingItem(
                    name=agent.name or "",
                    description=agent.description or "",
                    roles=[str(r) for r in (agent.roles or [])] if agent.roles else [],
                )

        # Get IDs
        scenario_ids = [str(sid) for sid in (result.scenario_ids or [])]
        video_ids = [str(vid) for vid in (result.video_ids or [])]
        valid_scenario_ids = [str(sid) for sid in (result.valid_scenario_ids or [])]
        valid_video_ids = [str(vid) for vid in (result.valid_video_ids or [])]
        valid_rubric_ids = [str(rid) for rid in (result.valid_rubric_ids or [])]
        valid_department_ids = [str(did) for did in (result.valid_department_ids or [])]
        valid_agent_ids = [str(aid) for aid in (result.valid_agent_ids or [])]

        # Set default department_ids based on role
        is_superadmin = False  # Will be determined from result if needed
        primary_department_id = result.primary_department_id
        if primary_department_id:
            department_ids = [str(primary_department_id)]
        else:
            department_ids = None

        response_data = SimulationDetailResponse(
            name=result.name or "",
            description=result.description or "",
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            time_limit=result.time_limit,
            rubric_id=str(result.rubric_id) if result.rubric_id else "",
            valid_rubric_ids=valid_rubric_ids,
            scenario_ids=scenario_ids,
            valid_scenario_ids=valid_scenario_ids,
            video_ids=video_ids,
            valid_video_ids=valid_video_ids,
            active=result.active or False,
            practice_simulation=result.practice_simulation or False,
            hint_agent_id=str(result.hint_agent_id) if result.hint_agent_id else None,
            grade_text_agent_id=str(result.grade_text_agent_id) if result.grade_text_agent_id else None,
            grade_voice_agent_id=str(result.grade_voice_agent_id) if result.grade_voice_agent_id else None,
            simulation_text_agent_id=str(result.simulation_text_agent_id) if result.simulation_text_agent_id else None,
            simulation_voice_agent_id=str(result.simulation_voice_agent_id) if result.simulation_voice_agent_id else None,
            can_edit=result.can_edit or False,
            can_duplicate=result.can_duplicate or False,
            can_delete=result.can_delete or False,
            in_use=result.in_use or False,
            cohort_count=result.cohort_count or 0,
            scenarios=scenarios_list,
            videos=videos_list,
            parameters=parameters_list,
            parameter_items=parameter_items_list,
            parameter_mapping=parameter_mapping,
            scenario_mapping=scenario_mapping,
            video_mapping=video_mapping,
            rubric_mapping=rubric_mapping,
            department_mapping=department_mapping,
            field_mapping=field_mapping_dict,
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
        )

        # Cache response (use mode='json' to serialize UUIDs)
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
            route_path=http_request.url.path,
            operation="get_simulation_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
