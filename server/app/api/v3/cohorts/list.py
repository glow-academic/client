"""Cohort list endpoint - v3 API."""

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


class PersonaMappingItem(BaseModel):
    """Persona mapping item with custom color and icon fields."""

    name: str
    description: str
    color: str
    icon: str
    image_model: bool | None = None


class ProfileMappingItem(BaseModel):
    """Profile mapping item."""

    name: str
    description: str


# Type aliases for Dict mappings (defined before ScenarioMappingItem to avoid forward reference issues)
PersonaMapping = dict[str, PersonaMappingItem]


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item with extended fields for nested data."""

    name: str
    description: str
    persona_ids: list[str] = []
    persona_mapping: "PersonaMapping" = {}
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


# Type aliases for Dict mappings
ScenarioMapping = dict[str, ScenarioMappingItem]


class CohortsListRequest(BaseModel):
    """Request for cohorts list."""

    # profileId removed - comes from X-Profile-Id header


class CohortItem(BaseModel):
    """Cohort item for list view."""

    cohort_id: str
    name: str
    description: str
    active: bool
    department_ids: list[str] | None = None
    profile_ids: list[str]
    simulation_ids: list[str]
    usage_count: int
    num_members: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    can_leave: bool
    updated_at: str


class CohortsListResponse(BaseModel):
    """Response for cohorts list."""

    cohorts: list[CohortItem]
    profile_mapping: dict[str, ProfileMappingItem]
    simulation_mapping: dict[str, SimulationMappingItem]
    scenario_mapping: ScenarioMapping
    simulation_scenario_mapping: dict[
        str, list[str]
    ]  # Maps simulation_id to scenario_ids
    department_mapping: dict[str, DepartmentMappingItem]
    # UI-ready facet options (precomputed on server)
    profile_options: list[dict[str, str]]  # Array of {value, label}
    simulation_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


def disambiguate_profiles(pmap: dict[str, ProfileMappingItem]) -> list[dict[str, str]]:
    """Build profile options with disambiguation for duplicate names."""
    names = Counter([v.name for v in pmap.values()])
    out = []
    for pid, v in pmap.items():
        label = v.name
        if names[v.name] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.name} ({pid[-8:]})"
        out.append({"value": pid, "label": label})
    return out


def disambiguate_simulations(
    smap: dict[str, SimulationMappingItem],
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


@router.post(
    "/list",
    response_model=CohortsListResponse,
    dependencies=[
        audit_activity("cohorts.list", "{{ actor.name }} visited the Cohorts page")
    ],
)
async def get_cohorts_list(
    filters: CohortsListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortsListResponse:
    """Get cohorts list with permissions and relationships."""
    tags = ["cohorts"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return CohortsListResponse.model_validate(cached["data"])

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

        sql_query = load_sql("sql/v3/cohorts/list_cohorts.sql")
        sql_params = (profile_id,)
        rows = await conn.fetch(sql_query, profile_id)

        # Get actor name from first row (same for all rows)
        actor_name = rows[0]["actor_name"] if rows else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        cohorts = []
        profile_mapping: dict[str, ProfileMappingItem] = {}
        simulation_mapping: dict[str, SimulationMappingItem] = {}
        scenario_mapping: ScenarioMapping = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}
        simulation_scenario_mapping: dict[str, dict[str, list[str]]] = {}

        for row in rows:
            # Convert UUID arrays to string arrays
            profile_ids = [str(pid) for pid in (row["profile_ids"] or [])]
            simulation_ids = [str(sid) for sid in (row["simulation_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            cohorts.append(
                CohortItem(
                    cohort_id=str(row["cohort_id"]),
                    name=row["name"],
                    description=row["description"],
                    active=row["active"],
                    department_ids=dept_ids,
                    profile_ids=profile_ids,
                    simulation_ids=simulation_ids,
                    usage_count=row["usage_count"],
                    num_members=row["num_members"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    can_leave=row["can_leave"],
                    updated_at=str(row["updated_at"]),
                )
            )

            # Parse mappings from first row (same for all cohorts)
            if not profile_mapping and row["profile_mapping"]:
                profile_data = row["profile_mapping"]
                if isinstance(profile_data, str):
                    profile_data = json.loads(profile_data)
                if isinstance(profile_data, dict):
                    for pid, pdata in profile_data.items():
                        if isinstance(pdata, dict):
                            profile_mapping[pid] = ProfileMappingItem(
                                name=pdata.get("name", ""),
                                description=pdata.get("description", ""),
                            )

            if not simulation_mapping and row["simulation_mapping"]:
                sim_data = row["simulation_mapping"]
                if isinstance(sim_data, str):
                    sim_data = json.loads(sim_data)
                if isinstance(sim_data, dict):
                    for sid, sdata in sim_data.items():
                        if isinstance(sdata, dict):
                            dept_ids_val = sdata.get("department_ids")
                            if isinstance(dept_ids_val, str):
                                dept_ids_val = json.loads(dept_ids_val)
                            # Store scenario_ids separately (not in SimulationMappingItem schema)
                            scenario_ids = sdata.get("scenario_ids", [])
                            simulation_scenario_mapping[sid] = {
                                "scenario_ids": [
                                    str(sid_val) for sid_val in scenario_ids
                                ]
                            }
                            simulation_mapping[sid] = SimulationMappingItem(
                                name=sdata.get("name", ""),
                                description=sdata.get("description", ""),
                                time_limit=sdata.get("time_limit"),
                                department_ids=dept_ids_val
                                if isinstance(dept_ids_val, list)
                                else None,
                            )

            if not department_mapping and row["department_mapping"]:
                dept_data = row["department_mapping"]
                if isinstance(dept_data, str):
                    dept_data = json.loads(dept_data)
                if isinstance(dept_data, dict):
                    for did, ddata in dept_data.items():
                        if isinstance(ddata, dict):
                            department_mapping[did] = DepartmentMappingItem(
                                name=ddata.get("name", ""),
                                description=ddata.get("description", ""),
                            )

            # Parse scenario_mapping from JSONB
            if not scenario_mapping and row.get("scenario_mapping"):
                scenario_mapping_data = row["scenario_mapping"]
                if isinstance(scenario_mapping_data, str):
                    scenario_mapping_data = json.loads(scenario_mapping_data)
                if isinstance(scenario_mapping_data, dict):
                    for sid, sdata in scenario_mapping_data.items():
                        if isinstance(sdata, dict):
                            # Parse nested persona_mapping
                            persona_mapping_parsed: PersonaMapping = {}
                            persona_mapping_raw = sdata.get("persona_mapping", {})
                            if isinstance(persona_mapping_raw, str):
                                persona_mapping_raw = json.loads(persona_mapping_raw)
                            if persona_mapping_raw and isinstance(
                                persona_mapping_raw, dict
                            ):
                                for pid, pdata in persona_mapping_raw.items():
                                    if isinstance(pdata, dict):
                                        persona_mapping_parsed[pid] = (
                                            PersonaMappingItem(
                                                name=pdata.get("name", ""),
                                                description=pdata.get(
                                                    "description", ""
                                                ),
                                                color=pdata.get("color", ""),
                                                icon=pdata.get("icon", ""),
                                                image_model=pdata.get(
                                                    "image_model", False
                                                ),
                                            )
                                        )

                            scenario_mapping[sid] = ScenarioMappingItem(
                                name=sdata.get("name", ""),
                                description=sdata.get("description", ""),
                                persona_ids=sdata.get("persona_ids", []),
                                persona_mapping=persona_mapping_parsed,
                                document_mapping={},
                                parameter_item_mapping={},
                                parameter_item_ids=[],
                                document_ids=[],
                            )

        # Get user departments for scoping all facet options
        user_department_rows = await conn.fetch(
            "SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true",
            profile_id,
        )
        user_department_ids = {
            str(row["department_id"]) for row in user_department_rows
        }

        # Get current user's role for role-based filtering
        user_role_row = await conn.fetchrow(
            "SELECT role FROM profiles WHERE id = $1",
            profile_id,
        )
        current_user_role = user_role_row["role"] if user_role_row else "guest"

        # Get roles for all profiles in profile_mapping for role-based filtering
        profile_ids_for_role_check = list(profile_mapping.keys())
        profile_roles_map = {}
        if profile_ids_for_role_check:
            profile_role_rows = await conn.fetch(
                """
                SELECT id, role
                FROM profiles
                WHERE id = ANY($1::uuid[])
                """,
                profile_ids_for_role_check,
            )
            profile_roles_map = {
                str(row["id"]): row["role"] for row in profile_role_rows
            }

        # Define role hierarchy (who can see which roles)
        def can_see_role(user_role: str, target_role: str) -> bool:
            """Check if user_role can see target_role based on role hierarchy."""
            if user_role == "superadmin":
                return True
            elif user_role == "admin":
                return target_role in ("admin", "instructional", "member", "guest")
            elif user_role == "instructional":
                return target_role in ("instructional", "member", "guest")
            elif user_role == "member":
                return target_role in ("member", "guest")
            elif user_role == "guest":
                return target_role == "guest"
            return False

        # Get user's profile departments for filtering profile options
        user_profile_department_rows = await conn.fetch(
            """
            SELECT DISTINCT pd2.profile_id
            FROM profile_departments pd1
            JOIN profile_departments pd2 ON pd2.department_id = pd1.department_id AND pd2.active = true
            WHERE pd1.profile_id = $1 AND pd1.active = true
            """,
            profile_id,
        )
        user_accessible_profile_ids = {
            str(row["profile_id"]) for row in user_profile_department_rows
        }

        # Build facet options
        # Filter profile_options to only include profiles from user's departments AND role hierarchy
        profile_options = [
            opt
            for opt in disambiguate_profiles(profile_mapping)
            if opt["value"] in user_accessible_profile_ids
            and can_see_role(
                current_user_role, profile_roles_map.get(opt["value"], "guest")
            )
        ]

        # Filter simulation_options to only include simulations from user's departments
        simulation_options = [
            opt
            for opt in disambiguate_simulations(simulation_mapping)
            if any(
                dept_id in user_department_ids
                for dept_id in (simulation_mapping[opt["value"]].department_ids or [])
            )
            or (
                # Include simulations with no departments (cross-department)
                not simulation_mapping[opt["value"]].department_ids
            )
        ]

        # Filter department_options to only include user departments (like documents list)
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
            if did in user_department_ids
        ]

        # Flatten simulation_scenario_mapping for response
        simulation_scenario_mapping_flat: dict[str, list[str]] = {}
        for sim_id, data in simulation_scenario_mapping.items():
            simulation_scenario_mapping_flat[sim_id] = data.get("scenario_ids", [])

        response_data = CohortsListResponse(
            cohorts=cohorts,
            profile_mapping=profile_mapping,
            simulation_mapping=simulation_mapping,
            scenario_mapping=scenario_mapping,
            simulation_scenario_mapping=simulation_scenario_mapping_flat,
            department_mapping=department_mapping,
            profile_options=profile_options,
            simulation_options=simulation_options,
            department_options=department_options,
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
            operation="get_cohorts_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
