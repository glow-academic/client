"""Rubric list endpoint - v3 API."""

import json
from collections import Counter
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class SimulationMappingItem(BaseModel):
    """Simulation mapping item."""

    name: str
    description: str
    time_limit: int | None = None
    department_ids: list[str] | None = None


class StandardGroupMappingItem(BaseModel):
    """Standard group mapping item."""

    name: str
    description: str
    points: int = 0
    passPoints: int = 0


class StandardMappingItem(BaseModel):
    """Standard mapping item with points."""

    name: str
    description: str
    points: int


# Type aliases for Dict mappings
SimulationMapping = dict[str, SimulationMappingItem]


class RubricsListRequest(BaseModel):
    """Request for rubrics list."""

    # profileId removed - comes from X-Profile-Id header


class RubricItem(BaseModel):
    """Rubric item for list view."""

    rubric_id: str
    name: str
    description: str
    points: int
    passPoints: int
    passPercentage: int
    agent_role: str | None = None
    department_ids: list[str] | None = None
    simulation_ids: list[str]
    active_simulation_count: int
    total_simulation_links: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    standard_groups: dict[str, list[str]]  # group_id -> [standard_ids]


class RubricsListResponse(BaseModel):
    """Response for rubrics list."""

    rubrics: list[RubricItem]
    standard_groups_mapping: dict[str, StandardGroupMappingItem]
    standards_mapping: dict[str, StandardMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    simulation_mapping: SimulationMapping
    simulation_options: list[dict[str, str]]  # Array of {value, label}


def disambiguate_simulations(
    smap: SimulationMapping,
) -> list[dict[str, str]]:
    """Build simulation options with disambiguation for duplicate names."""
    names = Counter([v.name for v in smap.values()])
    out = []
    for sid, v in smap.items():
        label = v.name
        if names[v.name] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.name} ({sid[-8:]})"
        out.append({"value": sid, "label": label})
    return out


router = APIRouter()


@router.post(
    "/list",
    response_model=RubricsListResponse,
    dependencies=[
        audit_activity("rubrics.list", "{{ actor.name }} visited the Rubrics page")
    ],
)
async def get_rubrics_list(
    filters: RubricsListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricsListResponse:
    """Get rubrics list with hierarchical structure and permissions."""
    tags = ["rubrics"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return RubricsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("sql/v3/rubrics/list_rubrics.sql")
        sql_params = (profile_id,)
        rows = await conn.fetch(sql_query, profile_id)

        # Get actor name from first row (same for all rows)
        actor_name = rows[0]["actor_name"] if rows else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        rubrics: list[RubricItem] = []
        standard_groups_mapping: dict[str, StandardGroupMappingItem] = {}
        standards_mapping: dict[str, StandardMappingItem] = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}
        simulation_mapping: SimulationMapping = {}

        # Parse mappings from first row (same across all rows, replicate v2 logic)
        if rows:
            first_row = rows[0]

            # Parse standard_groups_mapping from JSONB (replicate v2 logic)
            groups_mapping_data = first_row.get("standard_groups_mapping")
            if isinstance(groups_mapping_data, str):
                groups_mapping_data = json.loads(groups_mapping_data)
            if groups_mapping_data and isinstance(groups_mapping_data, dict):
                for group_id, gdata in groups_mapping_data.items():
                    if isinstance(gdata, dict):
                        standard_groups_mapping[group_id] = StandardGroupMappingItem(
                            name=gdata.get("name", ""),
                            description=gdata.get("description", ""),
                            points=gdata.get("points", 0),
                            passPoints=gdata.get("passPoints", 0),
                        )

            # Parse standards_mapping from JSONB (replicate v2 logic)
            standards_mapping_data = first_row.get("standards_mapping")
            if isinstance(standards_mapping_data, str):
                standards_mapping_data = json.loads(standards_mapping_data)
            if standards_mapping_data and isinstance(standards_mapping_data, dict):
                for standard_id, sdata in standards_mapping_data.items():
                    if isinstance(sdata, dict):
                        standards_mapping[standard_id] = StandardMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            points=sdata.get("points", 0),
                        )

            # Parse department_mapping from JSONB (replicate v2 logic)
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for dept_id, ddata in department_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[dept_id] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

            # Parse simulation_mapping from JSONB
            simulation_mapping_data = first_row.get("simulation_mapping")
            if isinstance(simulation_mapping_data, str):
                simulation_mapping_data = json.loads(simulation_mapping_data)
            if simulation_mapping_data and isinstance(simulation_mapping_data, dict):
                for sim_id, simdata in simulation_mapping_data.items():
                    if isinstance(simdata, dict):
                        simulation_mapping[sim_id] = SimulationMappingItem(
                            name=simdata.get("name", ""),
                            description=simdata.get("description", ""),
                        )

        # Build rubric items with hierarchical structure (replicate v2 logic)
        for row in rows:
            # Parse standard_groups structure for this rubric (replicate v2 logic)
            standard_groups_dict = {}
            standard_groups_data = row.get("standard_groups")
            # Parse JSONB string to dict (asyncpg returns JSONB as string)
            if isinstance(standard_groups_data, str):
                standard_groups_data = json.loads(standard_groups_data)
            if standard_groups_data and isinstance(standard_groups_data, dict):
                for group_id, standards_list in standard_groups_data.items():
                    if isinstance(standards_list, list):
                        standard_groups_dict[group_id] = standards_list
                    else:
                        standard_groups_dict[group_id] = []

            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            simulation_ids = []
            if row.get("simulation_ids"):
                simulation_ids = [str(sid) for sid in row["simulation_ids"]]

            # Compute passPercentage server-side
            points = row["points"]
            pass_points = row["passpoints"]
            pass_percentage = round((pass_points / points) * 100) if points > 0 else 0

            agent_role = None
            if row.get("agent_role"):
                agent_role = str(row["agent_role"])

            rubrics.append(
                RubricItem(
                    rubric_id=str(row["rubric_id"]),
                    name=row["name"],
                    description=row["description"],
                    agent_role=agent_role,
                    department_ids=dept_ids,
                    simulation_ids=simulation_ids,
                    points=points,
                    passPoints=pass_points,
                    passPercentage=pass_percentage,
                    active_simulation_count=row["active_simulation_count"],
                    total_simulation_links=row["total_simulation_links"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    standard_groups=standard_groups_dict,
                )
            )

        # Get user departments for scoping simulation_options
        user_department_rows = await conn.fetch(
            "SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true",
            profile_id,
        )
        user_department_ids = {
            str(row["department_id"]) for row in user_department_rows
        }

        # Collect department IDs actually assigned to rubrics
        assigned_department_ids = set()
        for rubric in rubrics:
            if rubric.department_ids:
                assigned_department_ids.update(rubric.department_ids)

        # Collect simulation IDs actually assigned to rubrics
        assigned_simulation_ids = set()
        for rubric in rubrics:
            assigned_simulation_ids.update(rubric.simulation_ids)

        # Build facet options
        # Filter simulation_options to only include simulations assigned to rubrics (no department filtering needed)
        simulation_options = [
            opt
            for opt in disambiguate_simulations(simulation_mapping)
            if opt["value"] in assigned_simulation_ids
        ]

        # Filter department_mapping to only include departments assigned to rubrics
        filtered_department_mapping = {
            did: d
            for (did, d) in department_mapping.items()
            if did in assigned_department_ids
        }

        response_data = RubricsListResponse(
            rubrics=rubrics,
            standard_groups_mapping=standard_groups_mapping,
            standards_mapping=standards_mapping,
            department_mapping=filtered_department_mapping,
            simulation_mapping=simulation_mapping,
            simulation_options=simulation_options,
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
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_rubrics_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
