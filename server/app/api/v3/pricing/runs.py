"""Pricing runs endpoint - POST /pricing/runs"""

import json
from datetime import datetime
from enum import Enum
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


router = APIRouter()


# Inline filter schemas
class PricingRunsFilters(BaseModel):
    """Pricing runs filter request schema."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    departmentIds: list[str] | None = None
    # Pagination, search, sorting, and additional filters
    page: int | None = None
    pageSize: int | None = None
    search: str | None = None
    sortBy: str | None = None
    sortOrder: str | None = None
    modelIds: list[str] | None = None  # Filter by specific models
    profileIds: list[str] | None = None  # Filter by specific profiles
    actorIds: list[str] | None = None  # Filter by specific agents/personas


# Inline schemas
class DebugInfoItem(BaseModel):
    """Debug information item."""

    id: str
    created_at: str
    content: str


class RunSummaryItem(BaseModel):
    """Run summary item within a group."""

    run_id: str
    created_at: str
    input_tokens: int
    output_tokens: int
    cost: float
    model_id: str | None = None
    profile_id: str | None = None
    agent_id: str | None = None
    persona_id: str | None = None
    debug_info: list[DebugInfoItem] | None = None


class GroupRunItem(BaseModel):
    """Group run item with aggregated metrics across multiple runs."""

    group_id: str
    created_at: str
    run_count: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost: float
    runs: list[RunSummaryItem]


class ModelMappingWithPricing(BaseModel):
    """Model mapping with pricing information."""

    name: str
    description: str
    input_ppm: float
    output_ppm: float


class FilterOption(BaseModel):
    """Filter option with count."""

    value: str
    label: str
    count: int


class PricingRunsResponse(BaseModel):
    """Response for pricing groups table."""

    data: list[GroupRunItem]
    totalCount: int
    page: int
    pageSize: int
    totalPages: int
    modelOptions: list[FilterOption] = []
    profileOptions: list[FilterOption] = []
    actorOptions: list[FilterOption] = []
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


@router.post("/runs", response_model=PricingRunsResponse)
async def get_pricing_runs(
    filters: PricingRunsFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingRunsResponse:
    """Get paginated, filtered, searched, sorted pricing runs for table."""
    tags = ["pricing"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            # Ensure cached data has new fields (for backward compatibility with old cache entries)
            cached_data = cached["data"]
            if "modelOptions" not in cached_data:
                cached_data["modelOptions"] = []
            if "profileOptions" not in cached_data:
                cached_data["profileOptions"] = []
            if "actorOptions" not in cached_data:
                cached_data["actorOptions"] = []
            return PricingRunsResponse.model_validate(cached_data)

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Build parameters for SQL query
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

        # Get profile_id from header (set by router-level dependency)
        # Note: profile_id is available but not used for filtering in this endpoint
        # It's read for consistency with other analytics endpoints
        profile_id = request.state.profile_id

        # Pricing runs shows aggregated data across all profiles
        # Uses profileIds (array) filter when users want to filter by specific profiles
        # SQL queries don't have a single profile_id parameter - they use profileIds array instead
        profile_uuid = None

        roles = filters.roles or None

        # Convert simulationFilters to list of strings for SQL
        simulation_filters = None
        if filters.simulationFilters:
            simulation_filters = [f.value for f in filters.simulationFilters]

        # Search parameter
        search = filters.search or None

        # Filter parameters
        model_ids = None
        if filters.modelIds:
            model_ids = [uuid.UUID(m) for m in filters.modelIds]

        profile_ids = None
        if filters.profileIds:
            profile_ids = [uuid.UUID(p) for p in filters.profileIds]

        actor_ids = None
        if filters.actorIds:
            actor_ids = [uuid.UUID(a) for a in filters.actorIds]

        # Build ORDER BY clause
        sort_by = filters.sortBy or "createdAt"
        sort_order = (filters.sortOrder or "desc").upper()

        # Map sortBy to actual column names
        # Note: cost calculation now uses run_pricing_usage joined with model_pricing
        # Groups are sorted by aggregated values
        sort_column_map = {
            "createdAt": "created_at",
            "inputTokens": "total_input_tokens",
            "outputTokens": "total_output_tokens",
            "cost": "total_cost",
            "runCount": "run_count",
        }

        sort_column = sort_column_map.get(sort_by, "created_at")
        # Add NULLS LAST to ensure NULL values are sorted to the end
        order_by_clause = f"ORDER BY {sort_column} {sort_order} NULLS LAST"
        # Also need ORDER BY in json_agg to preserve sort order
        json_agg_order_by = f"ORDER BY {sort_column} {sort_order} NULLS LAST"

        # Build LIMIT/OFFSET clause
        page = filters.page or 0
        page_size = filters.pageSize or 10
        offset = page * page_size
        limit_offset_clause = f"LIMIT {page_size} OFFSET {offset}"

        # Load SQL template
        sql_template = load_sql("sql/v3/pricing/runs.sql")

        # Replace placeholders in SQL template
        sql_query = sql_template.replace("{ORDER_BY_CLAUSE}", order_by_clause)
        sql_query = sql_query.replace("{LIMIT_OFFSET_CLAUSE}", limit_offset_clause)
        sql_query = sql_query.replace("{JSON_AGG_ORDER_BY}", json_agg_order_by)

        sql_params = (
            start_dt,
            end_dt,
            department_ids,
            profile_uuid,
            roles,
            cohort_ids,
            simulation_filters,
            search,
            model_ids,
            profile_ids,
            actor_ids,
        )

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            result = await conn.fetchval(sql_query, *sql_params)

        # Handle empty results gracefully - return empty structure instead of error
        # Parse JSONB result (may be string or dict)
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)
        # Ensure parsed_result is a dict (handle case where result is None or empty)
        if not isinstance(parsed_result, dict):
            parsed_result = {}

        # Extract data array and pagination metadata
        bundle_data = parsed_result.get("data", []) if parsed_result else []
        total_count = parsed_result.get("totalCount", 0) if parsed_result else 0
        page = filters.page or 0
        page_size = filters.pageSize or 10
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0

        # Parse filter options
        model_options_data = parsed_result.get("modelOptions", [])
        if isinstance(model_options_data, str):
            model_options_data = json.loads(model_options_data)
        model_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (
                model_options_data if isinstance(model_options_data, list) else []
            )
        ]

        profile_options_data = parsed_result.get("profileOptions", [])
        if isinstance(profile_options_data, str):
            profile_options_data = json.loads(profile_options_data)
        profile_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (
                profile_options_data if isinstance(profile_options_data, list) else []
            )
        ]

        actor_options_data = parsed_result.get("actorOptions", [])
        if isinstance(actor_options_data, str):
            actor_options_data = json.loads(actor_options_data)
        actor_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (
                actor_options_data if isinstance(actor_options_data, list) else []
            )
        ]

        # Build group runs list
        group_runs = []
        for group_data in bundle_data:
            # Parse nested runs
            runs_list = []
            runs_data = group_data.get("runs", [])
            if isinstance(runs_data, str):
                runs_data = json.loads(runs_data)
            if isinstance(runs_data, list):
                for run_data in runs_data:
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

                    runs_list.append(
                        RunSummaryItem(
                            run_id=run_data.get("run_id", ""),
                            created_at=run_data.get("created_at", ""),
                            input_tokens=run_data.get("input_tokens", 0),
                            output_tokens=run_data.get("output_tokens", 0),
                            cost=run_data.get("cost", 0.0),
                            model_id=run_data.get("model_id"),
                            profile_id=run_data.get("profile_id"),
                            agent_id=run_data.get("agent_id"),
                            persona_id=run_data.get("persona_id"),
                            debug_info=debug_info,
                        )
                    )

            group_runs.append(
                GroupRunItem(
                    group_id=group_data.get("group_id", ""),
                    created_at=group_data.get("created_at", ""),
                    run_count=group_data.get("run_count", 0),
                    total_input_tokens=group_data.get("total_input_tokens", 0),
                    total_output_tokens=group_data.get("total_output_tokens", 0),
                    total_cost=group_data.get("total_cost", 0.0),
                    runs=runs_list,
                )
            )

        # Build model mapping
        model_mapping: dict[str, ModelMappingWithPricing] = {}
        model_mapping_data = parsed_result.get("model_mapping", {})
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)
        if model_mapping_data and isinstance(model_mapping_data, dict):
            for model_id, model_data in model_mapping_data.items():
                if isinstance(model_data, dict):
                    model_mapping[model_id] = ModelMappingWithPricing(
                        name=model_data["name"],
                        description=model_data["description"],
                        input_ppm=model_data.get("input_ppm", 0.0),
                        output_ppm=model_data.get("output_ppm", 0.0),
                    )

        # Build profile mapping
        profile_mapping: dict[str, str] = {}
        profile_mapping_data = parsed_result.get("profile_mapping", {})
        if isinstance(profile_mapping_data, str):
            profile_mapping_data = json.loads(profile_mapping_data)
        if profile_mapping_data and isinstance(profile_mapping_data, dict):
            for profile_id, name in profile_mapping_data.items():
                if isinstance(name, str):
                    profile_mapping[profile_id] = name

        # Build agent mapping
        agent_mapping: dict[str, str] = {}
        agent_mapping_data = parsed_result.get("agent_mapping", {})
        if isinstance(agent_mapping_data, str):
            agent_mapping_data = json.loads(agent_mapping_data)
        if agent_mapping_data and isinstance(agent_mapping_data, dict):
            for agent_id, name in agent_mapping_data.items():
                if isinstance(name, str):
                    agent_mapping[agent_id] = name

        # Build persona mapping
        persona_mapping: dict[str, str] = {}
        persona_mapping_data = parsed_result.get("persona_mapping", {})
        if isinstance(persona_mapping_data, str):
            persona_mapping_data = json.loads(persona_mapping_data)
        if persona_mapping_data and isinstance(persona_mapping_data, dict):
            for persona_id, name in persona_mapping_data.items():
                if isinstance(name, str):
                    persona_mapping[persona_id] = name

        # Build response
        response_data = PricingRunsResponse(
            data=group_runs,
            totalCount=total_count,
            page=page,
            pageSize=page_size,
            totalPages=total_pages,
            modelOptions=model_options,
            profileOptions=profile_options,
            actorOptions=actor_options,
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
            operation="get_pricing_runs",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
