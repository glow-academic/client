"""Pricing analytics endpoint - POST /pricing"""

import json
from datetime import datetime
from enum import Enum
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error


# Inline mapping types (DHH style - no shared types)
class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


from utils.sql_helper import load_sql

router = APIRouter()


# Inline filter schemas
class PricingAnalyticsFilters(BaseModel):
    """Pricing analytics filter request schema."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    departmentIds: list[str] | None = None


# Inline schemas
class DebugInfoItem(BaseModel):
    """Debug information item."""

    id: str
    created_at: str
    content: str


class ModelRunItem(BaseModel):
    """Model run item with aggregated metrics."""

    model_run_id: str
    created_at: str
    input_tokens: int
    output_tokens: int
    model_id: str | None = None
    profile_id: str | None = None
    agent_id: str | None = None
    persona_id: str | None = None
    debug_info: list[DebugInfoItem] | None = None


class ModelMappingWithPricing(BaseModel):
    """Model mapping with pricing information."""

    name: str
    description: str
    input_ppm: float
    output_ppm: float


class PricingAnalyticsResponse(BaseModel):
    """Response for pricing analytics."""

    model_runs: list[ModelRunItem]
    model_mapping: dict[str, ModelMappingWithPricing]
    profile_mapping: dict[str, str]
    agent_mapping: dict[str, str]
    persona_mapping: dict[str, str]


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


@router.post(
    "/analytics",
    response_model=PricingAnalyticsResponse,
    dependencies=[
        audit_activity("pricing.analytics", "{{ actor.name }} viewed pricing analytics")
    ],
)
async def get_pricing(
    filters: PricingAnalyticsFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingAnalyticsResponse:
    """Get pricing metrics with model usage and cost analysis."""
    tags = ["pricing"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return PricingAnalyticsResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        # Note: profile_id is available but not used for filtering in this endpoint
        # It's read for consistency with other analytics endpoints
        profile_id = request.state.profile_id

        # Build parameters for consolidated SQL file (role check happens in SQL)
        start_dt = datetime.fromisoformat(filters.startDate.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(filters.endDate.replace("Z", "+00:00"))

        # Convert string UUIDs to UUID objects for asyncpg array parameters
        import uuid

        department_ids = None
        if filters.departmentIds:
            department_ids = [uuid.UUID(d) for d in filters.departmentIds]

        cohort_ids = None
        if filters.cohortIds:
            cohort_ids = [uuid.UUID(c) for c in filters.cohortIds]

        # Pricing analytics shows aggregated data across all profiles
        # Uses profileIds (array) filter when users want to filter by specific profiles
        # SQL queries don't have a single profile_id parameter - they use profileIds array instead
        profile_uuid = None

        roles = filters.roles or None

        # Convert simulationFilters to list of strings for SQL
        simulation_filters = None
        if filters.simulationFilters:
            simulation_filters = [f.value for f in filters.simulationFilters]

        # Execute consolidated SQL query with all filter logic (including role check)
        sql_query = load_sql("app/sql/v3/pricing/get_pricing_analytics_complete.sql")
        sql_params = (
            start_dt,
            end_dt,
            department_ids,
            profile_uuid,
            roles,
            cohort_ids,
            simulation_filters,
        )
        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            result = await conn.fetchval(sql_query, *sql_params)

        # Parse JSONB result
        parsed_result = _parse_json_strings_recursive(result or {})

        # Build model runs list
        model_runs = []
        for run_data in parsed_result.get("runs", []):
            debug_info = []
            if isinstance(run_data.get("debug_info"), list):
                for debug in run_data["debug_info"]:
                    if isinstance(debug, dict):
                        debug_info.append(
                            DebugInfoItem(
                                id=debug["id"],
                                created_at=debug["created_at"],
                                content=debug["content"],
                            )
                        )

            model_runs.append(
                ModelRunItem(
                    model_run_id=run_data.get("run_id") or run_data.get("model_run_id"),
                    created_at=run_data["created_at"],
                    input_tokens=run_data["input_tokens"],
                    output_tokens=run_data["output_tokens"],
                    model_id=run_data.get("model_id"),
                    profile_id=run_data.get("profile_id"),
                    agent_id=run_data.get("agent_id"),
                    persona_id=run_data.get("persona_id"),
                    debug_info=debug_info,
                )
            )

        # Build model mapping
        model_mapping: dict[str, ModelMappingWithPricing] = {}
        if isinstance(parsed_result.get("model_mapping"), dict):
            for model_id, model_data in parsed_result["model_mapping"].items():
                if isinstance(model_data, dict):
                    model_mapping[model_id] = ModelMappingWithPricing(
                        name=model_data["name"],
                        description=model_data["description"],
                        input_ppm=model_data.get("input_ppm", 0.0),
                        output_ppm=model_data.get("output_ppm", 0.0),
                    )

        # Build profile mapping
        profile_mapping: dict[str, str] = {}
        if isinstance(parsed_result.get("profile_mapping"), dict):
            for profile_id, name in parsed_result["profile_mapping"].items():
                if isinstance(name, str):
                    profile_mapping[profile_id] = name

        # Build agent mapping
        agent_mapping: dict[str, str] = {}
        if isinstance(parsed_result.get("agent_mapping"), dict):
            for agent_id, name in parsed_result["agent_mapping"].items():
                if isinstance(name, str):
                    agent_mapping[agent_id] = name

        # Build persona mapping
        persona_mapping: dict[str, str] = {}
        if isinstance(parsed_result.get("persona_mapping"), dict):
            for persona_id, name in parsed_result["persona_mapping"].items():
                if isinstance(name, str):
                    persona_mapping[persona_id] = name

        response_data = PricingAnalyticsResponse(
            model_runs=model_runs,
            model_mapping=model_mapping,
            profile_mapping=profile_mapping,
            agent_mapping=agent_mapping,
            persona_mapping=persona_mapping,
        )

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
            operation="get_pricing",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
