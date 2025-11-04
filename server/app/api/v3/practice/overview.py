"""Practice overview endpoint - POST /practice"""

import json
from typing import Annotated, Any, Literal

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (ParameterItemMapping, ParameterItemMappingItem,
                              ParameterMapping, ParameterMappingItem,
                              PersonaMapping, PersonaMappingItem,
                              ScenarioMapping, ScenarioMappingItem,
                              SimulationMapping, SimulationMappingItem,
                              StandardGroupsMapping, StandardsMapping)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter(prefix="/practice", tags=["practice"])

# Inline schemas (moved from app.schemas.practice and app.schemas.home)
class AttemptHistoryRow(BaseModel):
    """Attempt history row."""

    attemptId: str
    date: str
    profileId: str
    profileName: str
    simulationName: str
    numScenarios: int | None = None
    numScenariosCompleted: int
    infiniteMode: bool
    timeLimit: int | None = (
        None  # simulation time limit in seconds (from simulation_time_limits)
    )
    personaNames: list[str]
    personaColors: list[str]
    score: int | None = None
    simulation_id: str
    scenario_ids: list[str]
    scenario_titles: list[str]
    isArchived: bool
    showView: bool
    showContinue: bool
    practiceSimulation: bool
    passPct: int | None = None
    department_ids: list[str] | None = None  # Simulation's department associations
    cohortNames: list[str]


AttemptHistoryResponse = list[AttemptHistoryRow]


class PracticeSimulationItem(BaseModel):
    """Practice simulation item."""

    viewMode: Literal["practice"]
    id: str
    simulationTitle: str
    simulationDescription: str | None = None
    simulationName: str
    timeLimit: int | None = None
    numSessions: int
    highestScore: float | None = None
    standard_groups: dict[str, list[str]]
    color: str | None = None
    icon: str | None = None
    hasPassed: bool | None = None
    passRate: float | None = None
    status: Literal["not-started", "in-progress", "passed"] | None = None
    completionPct: float | None = None
    passedCount: int | None = None
    inProgressCount: int | None = None
    notStartedCount: int | None = None
    passPct: float | None = None
    cohortName: str | None = None
    updatedAt: str | None = None
    lastActivityTs: str | None = None
    hasActivity: bool | None = None


class PracticeOverviewResponse(BaseModel):
    """Practice overview response with mappings and history."""

    mode: Literal["practice"]
    hasData: bool
    items: list[PracticeSimulationItem]
    history: AttemptHistoryResponse
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping
    simulation_mapping: SimulationMapping
    scenario_mapping: ScenarioMapping
    persona_mapping: PersonaMapping
    parameter_mapping: ParameterMapping
    parameter_item_mapping: ParameterItemMapping


class PracticeFilters(BaseModel):
    """Practice filter request schema - simplified to profile-only."""

    profileId: str
    departmentIds: list[str] | None = None


def _parse_json_strings_recursive(obj: Any) -> Any:
    """Recursively parse JSON strings in nested structures."""
    if isinstance(obj, str):
        try:
            return json.loads(obj)
        except (json.JSONDecodeError, ValueError):
            return obj
    elif isinstance(obj, dict):
        return {k: _parse_json_strings_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_parse_json_strings_recursive(item) for item in obj]
    else:
        return obj


@router.post("", response_model=PracticeOverviewResponse)
async def get_practice_overview(
    filters: PracticeFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PracticeOverviewResponse:
    """Get practice overview data with history and all entity mappings.
    
    Practice uses simplified filters: only profileId and departmentIds.
    No cohort/role/date filtering for personal practice.
    """
    tags = ["practice"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return PracticeOverviewResponse.model_validate(cached["data"])
    
    try:
        # Validate that profile_id is provided (required for practice)
        if not filters.profileId:
            raise ValueError("profileId is required for practice overview")

        # Load SQL file
        query = load_sql("sql/v3/practice/practice_overview.sql")
        params = [
            filters.profileId,
            filters.departmentIds if filters.departmentIds else [],
        ]

        result = await conn.fetchval(query, *params)

        # Parse JSON string to dict if needed
        parsed_result = _parse_json_strings_recursive(result or {})

        # Parse embedded history
        history = []
        if isinstance(parsed_result.get("history"), list):
            for row in parsed_result["history"]:
                if isinstance(row, dict):
                    history.append(AttemptHistoryRow.model_validate(row))

        # Parse embedded simulation mapping
        simulation_mapping: dict[str, SimulationMappingItem] = {}
        if isinstance(parsed_result.get("simulation_mapping"), dict):
            for sim_id, sim_data in parsed_result["simulation_mapping"].items():
                if isinstance(sim_data, dict):
                    dept_ids = sim_data.get("department_ids")
                    if isinstance(dept_ids, str):
                        try:
                            dept_ids = json.loads(dept_ids)
                        except (json.JSONDecodeError, ValueError):
                            dept_ids = [dept_ids] if dept_ids else None
                    elif dept_ids is None:
                        dept_ids = None
                    elif not isinstance(dept_ids, list):
                        dept_ids = [dept_ids] if dept_ids else None
                    
                    simulation_mapping[str(sim_id)] = SimulationMappingItem(
                        name=sim_data.get("name", ""),
                        description=sim_data.get("description", ""),
                        time_limit=sim_data.get("time_limit"),
                        department_ids=dept_ids,
                    )

        # Parse embedded persona mapping
        persona_mapping: dict[str, PersonaMappingItem] = {}
        if isinstance(parsed_result.get("persona_mapping"), dict):
            for persona_id, persona_data in parsed_result["persona_mapping"].items():
                if isinstance(persona_data, dict):
                    persona_mapping[str(persona_id)] = PersonaMappingItem(
                        name=persona_data.get("name", ""),
                        description=persona_data.get("description", ""),
                        color=persona_data.get("color") or "",
                        icon=persona_data.get("icon") or "",
                        image_model=persona_data.get("image_model"),
                    )

        # Parse embedded scenario mapping
        scenario_mapping: dict[str, ScenarioMappingItem] = {}
        if isinstance(parsed_result.get("scenario_mapping"), dict):
            for scenario_id, scenario_data in parsed_result["scenario_mapping"].items():
                if isinstance(scenario_data, dict):
                    persona_ids = []
                    if scenario_data.get("persona_ids"):
                        persona_ids = scenario_data["persona_ids"] if isinstance(scenario_data["persona_ids"], list) else [scenario_data["persona_ids"]]
                    elif scenario_data.get("persona_id"):
                        persona_ids = [str(scenario_data["persona_id"])]
                    
                    scenario_mapping[str(scenario_id)] = ScenarioMappingItem(
                        name=scenario_data.get("name", ""),
                        description=scenario_data.get("description", ""),
                        persona_ids=persona_ids,
                        persona_mapping={},
                        document_mapping={},
                        parameter_item_mapping={},
                        parameter_item_ids=[],
                        document_ids=[],
                    )

        # Parse embedded parameter mapping
        parameter_mapping: dict[str, ParameterMappingItem] = {}
        if isinstance(parsed_result.get("parameter_mapping"), dict):
            for param_id, param_data in parsed_result["parameter_mapping"].items():
                if isinstance(param_data, dict):
                    parameter_mapping[str(param_id)] = ParameterMappingItem(
                        name=param_data.get("name", ""),
                        description=param_data.get("description", ""),
                        numerical=param_data.get("numerical", False),
                        document_parameter=param_data.get("document_parameter", False),
                    )

        # Parse embedded parameter_item mapping
        parameter_item_mapping: dict[str, ParameterItemMappingItem] = {}
        if isinstance(parsed_result.get("parameter_item_mapping"), dict):
            for item_id, item_data in parsed_result["parameter_item_mapping"].items():
                if isinstance(item_data, dict):
                    parameter_item_mapping[str(item_id)] = ParameterItemMappingItem(
                        name=item_data.get("name", ""),
                        description=item_data.get("description", ""),
                        parameter_id=item_data.get("parameter_id", ""),
                        parameter_name=item_data.get("parameter_name", ""),
                        value=item_data.get("value", ""),
                    )

        response_data = PracticeOverviewResponse(
            mode=parsed_result.get("mode", "practice"),
            hasData=parsed_result.get("hasData", False),
            items=parsed_result.get("items", []),
            history=history,
            standard_groups_mapping=parsed_result.get("standard_groups_mapping", {}),
            standards_mapping=parsed_result.get("standards_mapping", {}),
            simulation_mapping=simulation_mapping,  # type: ignore[arg-type]
            persona_mapping=persona_mapping,  # type: ignore[arg-type]
            scenario_mapping=scenario_mapping,  # type: ignore[arg-type]
            parameter_mapping=parameter_mapping,  # type: ignore[arg-type]
            parameter_item_mapping=parameter_item_mapping,  # type: ignore[arg-type]
        )
        
        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"
        
        return response_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

