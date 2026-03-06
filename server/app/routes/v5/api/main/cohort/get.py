"""Cohort GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_cohort_permissions_context — access check (404, 403, fail fast)
  3. resolve_cohort_context — artifact + draft → merged + hydrated resources
  4. score_tools — tool graph + artifact resources → per-resource tool picks
  5. Pure Python — permissions, show/required flags, response assembly
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from redis.asyncio import Redis

from app.infra.cohort_context import resolve_cohort_context
from app.infra.cohort_permissions_context import resolve_cohort_permissions_context
from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_redis_client
from app.infra.helpers import dedupe_by_id
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.cohort.permissions import (
    COHORT_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_profile_personas_required,
    compute_profiles_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_profile_personas,
    compute_show_profiles,
    compute_show_simulation_availability,
    compute_show_simulation_positions,
    compute_show_simulations,
    compute_simulation_availability_required,
    compute_simulation_positions_required,
    compute_simulations_required,
    has_access,
)
from app.routes.v5.api.main.cohort.types import (
    CohortDepartment,
    CohortDepartmentSection,
    CohortDescriptionSection,
    CohortFlagConfig,
    CohortFlagSection,
    CohortNameSection,
    CohortProfile,
    CohortProfilePersona,
    CohortProfilePersonaSection,
    CohortProfileSection,
    CohortSimulation,
    CohortSimulationAvailability,
    CohortSimulationAvailabilitySection,
    CohortSimulationPosition,
    CohortSimulationPositionSection,
    CohortSimulationSection,
    GetCohortApiRequest,
    GetCohortApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


# ---------------------------------------------------------------------------
# get_cohort_client — composable infra architecture
# ---------------------------------------------------------------------------


async def get_cohort_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    cohort_id: UUID | None,
    draft_id: UUID | None = None,
    group_id: UUID,
    descriptions_search: str | None = None,
    simulation_search: str | None = None,
    simulation_show_selected: bool | None = None,
    profile_search: str | None = None,
    profile_show_selected: bool | None = None,
    bypass_cache: bool = False,
) -> GetCohortApiResponse:
    """Cohort GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_cohort_permissions_context → access check (404, 403, fail fast)
      3. resolve_cohort_context(cohort_id, draft_id, ...) → hydrated resources
      4. score_tools(tool_graph, COHORT_RESOURCES) → per-resource tool picks
      5. Pure Python: permissions, show/required/AI flags, response assembly
    """

    # ── Step 1: Common context (profile → tool_graph + runs) ──────────────

    common = await resolve_common_context(
        conn,
        redis,
        profile_id=profile_id,
        group_id=group_id,
        bypass_cache=bypass_cache,
    )

    if common is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    profile = common.profile

    # ── Step 2: Permissions check (fail fast before full hydration) ────────

    perms = None
    if cohort_id is not None:
        perms = await resolve_cohort_permissions_context(conn, cohort_id)

        if not perms.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Cohort {cohort_id} not found",
            )

        if not has_access(profile.role, profile.department_ids, perms.department_ids):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this cohort. "
                "It may be restricted to other departments.",
            )

    # ── Step 3: Cohort artifact context ─────────────────────────────────

    cohort = await resolve_cohort_context(
        conn,
        redis,
        cohort_id=cohort_id,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=profile.department_ids,
        descriptions_search=descriptions_search,
        simulation_search=simulation_search,
        simulation_show_selected=simulation_show_selected,
        profile_search=profile_search,
        profile_show_selected=profile_show_selected,
        bypass_cache=bypass_cache,
    )

    # ── Step 4: Tool scoring ──────────────────────────────────────────────

    scores = score_tools(common.tool_graph, COHORT_RESOURCES)

    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in COHORT_RESOURCES
    }

    # ── Step 5: Permissions ───────────────────────────────────────────────

    cohort_department_ids = [
        d.id for d in cohort.resources["departments"].selected if d.id
    ]

    can_edit = compute_can_edit(
        user_role=profile.role,
        cohort_department_ids=cohort_department_ids,
        user_department_ids=profile.department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=profile.role,
        cohort_department_ids=cohort_department_ids,
        user_department_ids=profile.department_ids,
    )

    # ── Step 6: Show / Required / AI flags ────────────────────────────────

    all_departments = dedupe_by_id(
        cohort.resources["departments"].selected
        + cohort.resources["departments"].suggestions
    )
    all_simulations = dedupe_by_id(
        cohort.resources["simulations"].selected
        + cohort.resources["simulations"].suggestions
    )
    all_profiles = dedupe_by_id(
        cohort.resources["profiles"].selected
        + cohort.resources["profiles"].suggestions
    )
    all_simulation_positions = cohort.resources["simulation_positions"].selected
    all_simulation_availability = cohort.resources["simulation_availability"].selected
    all_profile_personas = cohort.resources["profile_personas"].selected

    # Validate new mode
    if cohort_id is None and not all_departments:
        raise HTTPException(
            status_code=400, detail="No accessible departments found for user"
        )

    show_departments_flag = compute_show_departments(len(all_departments))

    show_flags_map = {
        "names": compute_show_name(),
        "descriptions": compute_show_description(),
        "flags": compute_show_flag(),
        "departments": show_departments_flag,
        "simulations": compute_show_simulations(len(all_simulations)),
        "simulation_positions": compute_show_simulation_positions(
            len(all_simulation_positions)
        ),
        "simulation_availability": compute_show_simulation_availability(
            len(all_simulation_availability)
        ),
        "profiles": compute_show_profiles(len(all_profiles)),
        "profile_personas": compute_show_profile_personas(len(all_profile_personas)),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(show_departments_flag),
        "simulations": compute_simulations_required(),
        "simulation_positions": compute_simulation_positions_required(),
        "simulation_availability": compute_simulation_availability_required(),
        "profiles": compute_profiles_required(),
        "profile_personas": compute_profile_personas_required(),
    }

    show_ai_generate_map = {
        r: scores.best.get(r) is not None for r in COHORT_RESOURCES
    }

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False)
        for r in ("names", "descriptions", "flags", "departments")
    )
    simulations_step_show_ai_generate = any(
        show_ai_generate_map.get(r, False)
        for r in ("simulations", "simulation_positions", "simulation_availability")
    )
    profiles_step_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in ("profiles", "profile_personas")
    )

    suggestions_map: dict[str, list[UUID]] = {
        "names": [n.id for n in cohort.resources["names"].suggestions],
        "descriptions": [
            d.id for d in cohort.resources["descriptions"].suggestions
        ],
        "departments": [
            d.id for d in cohort.resources["departments"].suggestions
        ],
        "simulations": [
            s.id
            for s in cohort.resources["simulations"].suggestions
            if s.id
        ],
        "profiles": [
            p.id for p in cohort.resources["profiles"].suggestions if p.id
        ],
    }

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    # ── Step 7: Resource conversion + response assembly ───────────────────

    # Converters
    def _to_department(d) -> CohortDepartment:
        return CohortDepartment(
            department_id=d.id,
            name=d.name,
            description=d.description,
            generated=d.generated,
        )

    def _to_simulation(s) -> CohortSimulation:
        return CohortSimulation(
            simulation_id=s.id,
            name=s.name,
            description=s.description,
            generated=s.generated,
        )

    def _to_profile(p) -> CohortProfile:
        return CohortProfile(
            profile_id=p.id,
            name=p.name,
            description=p.description,
        )

    def _to_simulation_position(sp) -> CohortSimulationPosition:
        return CohortSimulationPosition(
            simulation_id=sp.simulation_id,
            value=sp.value,
            generated=sp.generated,
            mcp=sp.mcp,
        )

    def _to_simulation_availability(sa) -> CohortSimulationAvailability:
        return CohortSimulationAvailability(
            id=sa.id,
            simulation_id=sa.simulation_id,
            time=sa.time,
            type=sa.type,
            generated=sa.generated,
            mcp=sa.mcp,
        )

    def _to_profile_persona(pp) -> CohortProfilePersona:
        return CohortProfilePersona(
            id=pp.id,
            profile_id=pp.profile_id,
            persona_id=pp.persona_id,
            generated=pp.generated,
        )

    # Build flag configs
    all_flags = (
        cohort.resources["flags"].selected
        + cohort.resources["flags"].suggestions
    )
    flag_configs = [
        CohortFlagConfig(
            key=f.name,
            label=f.name,
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            generated=f.generated,
        )
        for f in all_flags
        if f.id
    ]

    flag_ids_set = {f.id for f in cohort.resources["flags"].selected}

    # Convert resources
    all_names = dedupe_by_id(
        cohort.resources["names"].selected
        + cohort.resources["names"].suggestions
    )
    all_descriptions = dedupe_by_id(
        cohort.resources["descriptions"].selected
        + cohort.resources["descriptions"].suggestions
    )
    all_departments_conv = [_to_department(d) for d in all_departments]
    all_simulations_conv = [_to_simulation(s) for s in all_simulations]
    all_profiles_conv = [_to_profile(p) for p in all_profiles]
    all_sim_positions_conv = [_to_simulation_position(sp) for sp in all_simulation_positions]
    all_sim_availability_conv = [
        _to_simulation_availability(sa) for sa in all_simulation_availability
    ]
    all_profile_personas_conv = [_to_profile_persona(pp) for pp in all_profile_personas]

    current_departments = [
        _to_department(d) for d in cohort.resources["departments"].selected
    ]
    current_simulations = [
        _to_simulation(s) for s in cohort.resources["simulations"].selected
    ]
    current_profiles = [
        _to_profile(p) for p in cohort.resources["profiles"].selected
    ]

    return GetCohortApiResponse(
        # Context
        actor_name=profile.name,
        cohort_exists=cohort.artifact_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=cohort.draft_version,
        group_id=group_id,
        # Step-level AI generation flags
        basic_show_ai_generate=basic_show_ai_generate,
        simulations_step_show_ai_generate=simulations_step_show_ai_generate,
        profiles_step_show_ai_generate=profiles_step_show_ai_generate,
        # Per-resource sections
        names=CohortNameSection(
            **_section("names"),
            resource=cohort.resources["names"].selected[0]
            if cohort.resources["names"].selected
            else None,
            resources=all_names,
        ),
        descriptions=CohortDescriptionSection(
            **_section("descriptions"),
            resource=cohort.resources["descriptions"].selected[0]
            if cohort.resources["descriptions"].selected
            else None,
            resources=all_descriptions,
        ),
        flags=CohortFlagSection(
            **_section("flags"),
            resource=next(
                (f for f in flag_configs if f.flag_option_id in flag_ids_set), None
            ),
            resources=flag_configs,
        ),
        departments=CohortDepartmentSection(
            **_section("departments"),
            current=current_departments,
            resources=all_departments_conv,
        ),
        simulations=CohortSimulationSection(
            **_section("simulations"),
            current=current_simulations,
            resources=all_simulations_conv,
        ),
        simulation_positions=CohortSimulationPositionSection(
            **_section("simulation_positions"),
            current=all_sim_positions_conv,
            resources=all_sim_positions_conv,
        ),
        simulation_availability=CohortSimulationAvailabilitySection(
            **_section("simulation_availability"),
            current=all_sim_availability_conv,
            resources=all_sim_availability_conv,
        ),
        profiles=CohortProfileSection(
            **_section("profiles"),
            current=current_profiles,
            resources=all_profiles_conv,
        ),
        profile_personas=CohortProfilePersonaSection(
            **_section("profile_personas"),
            current=all_profile_personas_conv,
            resources=all_profile_personas_conv,
        ),
        personas=cohort.resources["personas"].suggestions,
    )


# ---------------------------------------------------------------------------
# get_cohort_websocket — stub (to be rewritten with infra functions)
# ---------------------------------------------------------------------------


async def get_cohort_websocket(*args, **kwargs):
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_cohort_websocket needs to be rewritten with infra functions"
    )


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=GetCohortApiResponse)
async def get_cohort(
    request: GetCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortApiResponse:
    """Get cohort information using composable infra architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await get_cohort_client(
            conn,
            redis,
            profile_id=profile_id,
            cohort_id=request.cohort_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            descriptions_search=request.descriptions_search,
            simulation_search=request.simulation_search,
            simulation_show_selected=request.simulation_show_selected,
            profile_search=request.profile_search,
            profile_show_selected=request.profile_show_selected,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "cohorts"
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
            operation="get_cohort",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
