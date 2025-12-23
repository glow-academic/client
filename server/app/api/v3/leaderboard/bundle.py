"""Leaderboard bundle v3 API endpoint."""

import json
from enum import Enum
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from datetime import datetime
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class PersonaMappingItem(BaseModel):
    """Persona mapping item with custom color and icon fields."""

    name: str
    description: str
    color: str
    icon: str
    image_model: bool | None = None


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item with extended fields for nested data."""

    name: str
    description: str
    persona_ids: list[str] = []
    persona_mapping: dict[str, PersonaMappingItem] = {}
    document_mapping: dict[str, Any] = {}
    parameter_item_mapping: dict[str, Any] = {}
    parameter_item_ids: list[str] = []
    document_ids: list[str] = []


class SimulationMappingItem(BaseModel):
    """Simulation mapping item."""

    name: str
    description: str
    time_limit: int | None = None
    department_ids: list[str] | None = None


class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


# Type aliases for Dict mappings
ScenarioMapping = dict[str, ScenarioMappingItem]
SimulationMapping = dict[str, SimulationMappingItem]
from app.utils.theme.oklch_to_hex import oklch_to_hex

router = APIRouter()


# Inline filter schemas
class LeaderboardBundleFilters(BaseModel):
    """Leaderboard bundle filter request schema - for general leaderboard (multi-cohort or all cohorts)."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None  # Optional: can be empty or multiple cohorts
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    departmentIds: list[str] | None = None


# Inline schemas
class LeaderboardMetric(BaseModel):
    """Leaderboard metric."""

    hasData: bool
    method: str
    currentValue: int
    keyField: str | None = None
    trendData: list[Any]
    dataPoints: list[Any]
    hover: dict[str, Any]


class LeaderboardMetrics(BaseModel):
    """Leaderboard metrics."""

    totalAttempts: LeaderboardMetric
    highestScoreAvg: LeaderboardMetric
    messagesPerSession: LeaderboardMetric
    personaResponseSeconds: LeaderboardMetric
    timeSpentMinutes: LeaderboardMetric
    improvementRatePerDay: LeaderboardMetric
    perfectScoreCount: LeaderboardMetric
    quickestPassMinutes: LeaderboardMetric


class LeaderboardRow(BaseModel):
    """Leaderboard row."""

    profileId: str
    firstName: str
    lastName: str
    simulationIds: list[str] = []
    scenarioIds: list[str] = []
    metrics: LeaderboardMetrics


class LeaderboardBundleResponse(BaseModel):
    """Leaderboard bundle response."""

    data: list[LeaderboardRow]
    simulation_mapping: SimulationMapping = {}
    scenario_mapping: ScenarioMapping = {}
    primary_color: str = "#171717"
    accent_color: str = "#f5f5f5"
    gradient_start_color: str = "rgba(59, 130, 246, 0.8)"
    gradient_end_color: str = "rgba(59, 130, 246, 0.8)"


@router.post(
    "/bundle",
    response_model=LeaderboardBundleResponse,
    dependencies=[
        audit_activity("leaderboard.bundle", "{{ actor.name }} viewed leaderboard")
    ],
)
async def get_leaderboard(
    filters: LeaderboardBundleFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardBundleResponse:
    """Get leaderboard bundle with all metrics and profile data."""
    tags = ["leaderboard"]  # From router tags

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
        # Get profile_id from header (set by router-level dependency)
        # Note: profile_id is read for consistency but not used for filtering
        # Leaderboard shows aggregated data across all profiles
        profile_id = request.state.profile_id

        # Build WHERE clause inline
        conditions = []
        params: list[Any] = []
        param_counter = 1

        # Date filters - convert ISO strings to datetime objects
        conditions.append(f"a.attempt_created_at >= ${param_counter}")
        params.append(datetime.fromisoformat(filters.startDate.replace("Z", "+00:00")))
        param_counter += 1

        conditions.append(f"a.attempt_created_at < ${param_counter}")
        params.append(datetime.fromisoformat(filters.endDate.replace("Z", "+00:00")))
        param_counter += 1

        # Simulation type filters
        sim_filters = [f.value for f in filters.simulationFilters] if filters.simulationFilters else ["general"]
        sim_conditions = []

        if "general" in sim_filters:
            sim_conditions.append("a.is_general = TRUE")
        if "practice" in sim_filters:
            sim_conditions.append("a.is_practice = TRUE")
        if "archived" in sim_filters:
            if "general" not in sim_filters and "practice" not in sim_filters:
                sim_conditions.append("a.is_archived = TRUE")
            else:
                sim_conditions.append(
                    "(a.is_archived = TRUE OR (a.is_general = FALSE AND a.is_practice = FALSE))"
                )

        if sim_conditions:
            conditions.append(f"({' OR '.join(sim_conditions)})")

        # Profile filter - not used for leaderboard (shows aggregated data)

        # Role filter
        if filters.roles:
            conditions.append(f"a.profile_role = ANY(${param_counter})")
            params.append(filters.roles)
            param_counter += 1

        # Simulation filter by cohorts
        if filters.cohortIds:
            conditions.append(
                f"""a.simulation_id IN (
                    SELECT DISTINCT s.id
                    FROM simulations s
                    WHERE s.active = TRUE
                      AND (
                          EXISTS (
                              SELECT 1 
                              FROM cohort_simulations cs 
                              WHERE cs.simulation_id = s.id 
                                AND cs.cohort_id = ANY(${param_counter}::uuid[])
                                AND cs.active = TRUE
                          )
                          OR
                          (s.practice_simulation = TRUE 
                           AND NOT EXISTS (
                               SELECT 1 
                               FROM cohort_simulations cs2 
                               WHERE cs2.simulation_id = s.id 
                                 AND cs2.active = TRUE
                           ))
                      )
                )"""
            )
            params.append(filters.cohortIds)
            param_counter += 1

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        # Load SQL template
        sql_template = load_sql("sql/v3/leaderboard/leaderboard_bundle.sql")

        # Replace WHERE clause placeholder
        sql_query = sql_template.replace("{WHERE_CLAUSE}", where_clause)
        sql_params = tuple(params)

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
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

        # Extract colors from parsed result
        primary_color = parsed_result.get("primary_color", "#171717")
        accent_color = parsed_result.get("accent_color", "#f5f5f5")

        # Generate gradient colors from primary_color
        def generate_gradient_colors(color: str) -> tuple[str, str]:
            """Generate gradient start and end colors from a color string."""
            # Convert oklch to hex if needed
            if color.startswith("oklch("):
                hex_color = oklch_to_hex(color)
            elif color.startswith("#"):
                hex_color = color
            else:
                # Assume hex without #
                hex_color = f"#{color}"

            # Parse hex to RGB
            hex_clean = hex_color.lstrip("#")
            r = int(hex_clean[0:2], 16)
            g = int(hex_clean[2:4], 16)
            b = int(hex_clean[4:6], 16)

            # Create lighter variant (add 60 to each RGB component, cap at 255)
            lighter_r = min(255, r + 60)
            lighter_g = min(255, g + 60)
            lighter_b = min(255, b + 60)

            # Return rgba strings for CSS (with 0.8 opacity for gradient border)
            start_color = f"rgba({lighter_r}, {lighter_g}, {lighter_b}, 0.8)"
            end_color = f"rgba({r}, {g}, {b}, 0.8)"

            return start_color, end_color

        gradient_start, gradient_end = generate_gradient_colors(primary_color)

        # Add gradient colors to parsed result
        parsed_result["gradient_start_color"] = gradient_start
        parsed_result["gradient_end_color"] = gradient_end

        # Validate and return response
        response_data = LeaderboardBundleResponse.model_validate(parsed_result)

        # Fetch actor_name separately
        actor_name = None
        if profile_id:
            actor_name_row = await conn.fetchrow(
                "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
                profile_id,
            )
            actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

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
            operation="get_leaderboard",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
