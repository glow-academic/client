"""Leaderboard cohort detail v3 API endpoint - requires cohortId."""

import json
from datetime import datetime
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (ScenarioMapping, ScenarioMappingItem,
                              SimulationFilter, SimulationMapping)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class LeaderboardCohortDetailFilters(BaseModel):
    """Leaderboard cohort detail filter request schema - requires single cohortId."""

    startDate: str
    endDate: str
    cohortId: str  # Required: single cohort ID
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    departmentIds: list[str] | None = None


# Import shared response types from bundle
from app.api.v3.leaderboard.bundle import (LeaderboardBundleResponse,
                                           LeaderboardMetric,
                                           LeaderboardMetrics, LeaderboardRow)


@router.post("/cohort", response_model=LeaderboardBundleResponse)
async def get_leaderboard_cohort_detail(
    filters: LeaderboardCohortDetailFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardBundleResponse:
    """Get leaderboard bundle for a specific cohort - requires cohortId."""
    tags = ["leaderboard", "cohort-detail"]

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return LeaderboardBundleResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Build parameters for cohort detail SQL
        # $1-$2: dates, $3: cohort_id (required), $4: roles, $5: sim_filters, $6: department_ids
        start_dt = datetime.fromisoformat(filters.startDate.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(filters.endDate.replace("Z", "+00:00"))
        cohort_id = filters.cohortId  # Required
        roles = filters.roles or []
        sim_filters = (
            [
                f.value if isinstance(f, SimulationFilter) else f
                for f in filters.simulationFilters
            ]
            if filters.simulationFilters
            else ["general"]
        )
        department_ids = filters.departmentIds or []

        # Load SQL query
        sql_query = load_sql("sql/v3/leaderboard/cohort_detail.sql")
        sql_params = (
            start_dt,
            end_dt,
            cohort_id,
            roles,
            sim_filters,
            department_ids,
        )

        # Disable JIT compilation for this complex query
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            result = await conn.fetchval(sql_query, *sql_params)

        # Parse any JSON strings in nested structures
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)

        # Recursively parse JSON strings
        def parse_json_strings_recursive(obj: Any) -> Any:  # noqa: ANN401
            """Recursively parse JSON strings in nested structures."""
            if isinstance(obj, str):
                try:
                    return json.loads(obj)
                except (json.JSONDecodeError, ValueError):
                    return obj
            elif isinstance(obj, dict):
                return {k: parse_json_strings_recursive(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [parse_json_strings_recursive(item) for item in obj]
            else:
                return obj

        parsed_result = parse_json_strings_recursive(parsed_result)

        # Parse simulation and scenario mappings
        simulation_mapping: dict[str, Any] = {}
        if isinstance(parsed_result.get("simulation_mapping"), dict):
            simulation_mapping = parsed_result["simulation_mapping"]
        elif isinstance(parsed_result.get("simulation_mapping"), str):
            try:
                simulation_mapping = json.loads(parsed_result["simulation_mapping"])
            except (json.JSONDecodeError, ValueError):
                simulation_mapping = {}

        # Parse scenario mapping and transform to ScenarioMappingItem format
        scenario_mapping: ScenarioMapping = {}
        scenario_mapping_raw = parsed_result.get("scenario_mapping")
        if isinstance(scenario_mapping_raw, str):
            try:
                scenario_mapping_raw = json.loads(scenario_mapping_raw)
            except (json.JSONDecodeError, ValueError):
                scenario_mapping_raw = {}
        
        if isinstance(scenario_mapping_raw, dict):
            for scenario_id, scenario_data in scenario_mapping_raw.items():
                if isinstance(scenario_data, dict):
                    persona_ids = []
                    if scenario_data.get("persona_ids"):
                        persona_ids = (
                            scenario_data["persona_ids"]
                            if isinstance(scenario_data["persona_ids"], list)
                            else [scenario_data["persona_ids"]]
                        )
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

        # Ensure mappings are in the correct format
        parsed_result["simulation_mapping"] = simulation_mapping
        parsed_result["scenario_mapping"] = {
            k: v.model_dump() for k, v in scenario_mapping.items()
        }

        # Validate and return response
        response_data = LeaderboardBundleResponse.model_validate(parsed_result)

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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_leaderboard_cohort_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

