"""Resolve home context — raw MV reads + hydrated resources.

Home is a dashboard endpoint with no artifact table and no drafts.
Access is cohort-based: user's profile → cohort search → filter homes.

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.types import ArtifactContext, ResourcePair

# Cohort artifact tools
from app.routes.v5.tools.artifacts.cohort.get import get_cohorts as get_cohort_artifacts
from app.routes.v5.tools.artifacts.cohort.search import search_cohorts

# Entry fetchers (raw MV reads)
from app.routes.v5.tools.entries.attempt.search import search_attempts
from app.routes.v5.tools.entries.attempt_chat.search import search_attempt_chats
from app.routes.v5.tools.entries.home.search import search_homes

# Resource get fetchers
from app.routes.v5.tools.resources.cohorts.get import (
    get_cohorts as get_cohort_resources,
)
from app.routes.v5.tools.resources.personas.get import get_personas
from app.routes.v5.tools.resources.rubrics.get import get_rubrics
from app.routes.v5.tools.resources.scenario_time_limits.get import (
    get_scenario_time_limits,
)
from app.routes.v5.tools.resources.scenarios.get import get_scenarios
from app.routes.v5.tools.resources.simulations.get import get_simulations
from app.routes.v5.tools.resources.standard_groups.get import get_standard_groups
from app.routes.v5.tools.resources.standards.search import search_standards


async def resolve_home_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profiles_resource_id: UUID,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve home dashboard context from raw MVs + hydrated resources.

    Steps:
      1. Resolve user's cohort IDs via search_cohorts(profile_ids=...)
      2. Parallel: search_homes + search_attempt_chats + search_attempts + get_cohort_artifacts
      3. Filter homes by cohort overlap (Python)
      4. Collect simulation_ids, scenario_ids from filtered homes
      5. Parallel hydrate: simulations, scenarios, cohort resources, rubrics, time_limits
      6. Derive persona_ids from scenarios → fetch personas
      7. Derive standard_group_ids from rubrics → fetch standard_groups + standards
      8. Return ArtifactContext
    """
    # Step 1: Resolve user's cohort IDs
    user_cohort_ids = await search_cohorts(
        conn,
        profile_ids=[profiles_resource_id],
        limit_count=1000,
    )

    # Step 2: Parallel raw MV reads + cohort artifact data
    (
        all_homes,
        all_attempt_chats,
        all_attempts,
        cohort_artifact_data,
    ) = await asyncio.gather(
        search_homes(conn, limit=10000),
        search_attempt_chats(
            conn,
            profile_ids=[profiles_resource_id],
            limit=10000,
        ),
        search_attempts(
            conn,
            profile_ids=[profiles_resource_id],
            limit=10000,
        ),
        get_cohort_artifacts(
            conn,
            user_cohort_ids,
            simulations=True,
        )
        if user_cohort_ids
        else _empty_list(),
    )

    # Step 3: Filter homes by cohort overlap
    user_cohort_set = set(user_cohort_ids)
    filtered_homes = [
        h
        for h in all_homes
        if h.active and h.cohort_ids and user_cohort_set & set(h.cohort_ids)
    ]

    # Step 4: Collect resource IDs from filtered homes
    simulation_ids: list[UUID] = []
    all_scenario_ids: set[UUID] = set()
    all_cohort_ids: set[UUID] = set()

    for h in filtered_homes:
        simulation_ids.extend(h.simulation_ids or [])
        all_scenario_ids.update(h.scenario_ids or [])
        all_cohort_ids.update(h.cohort_ids or [])

    simulation_ids_deduped = list(dict.fromkeys(simulation_ids))
    scenario_ids_list = list(all_scenario_ids)
    cohort_ids_list = list(all_cohort_ids)

    # Step 5: Parallel hydrate — simulations, scenarios, cohort resources, rubrics
    (
        simulations_selected,
        scenarios_selected,
        cohorts_selected,
    ) = await asyncio.gather(
        get_simulations(conn, simulation_ids_deduped, redis, bypass_cache)
        if simulation_ids_deduped
        else _empty_list(),
        get_scenarios(conn, scenario_ids_list, redis, bypass_cache)
        if scenario_ids_list
        else _empty_list(),
        get_cohort_resources(conn, cohort_ids_list, redis, bypass_cache)
        if cohort_ids_list
        else _empty_list(),
    )

    # Step 6: Derive persona_ids from scenarios, rubric/time_limit IDs from simulations
    all_persona_ids: set[UUID] = set()
    for s in scenarios_selected:
        if s.persona_ids:
            all_persona_ids.update(s.persona_ids)

    # Derive rubric_ids + time_limit_ids from simulations
    all_rubric_ids: set[UUID] = set()
    all_time_limit_ids: set[UUID] = set()
    for sim in simulations_selected:
        if sim.scenario_rubric_ids:
            all_rubric_ids.update(sim.scenario_rubric_ids)
        if sim.scenario_time_limit_ids:
            all_time_limit_ids.update(sim.scenario_time_limit_ids)

    rubric_ids_list = list(all_rubric_ids)
    time_limit_ids_list = list(all_time_limit_ids)

    (
        personas_selected,
        rubrics_selected,
        time_limits_selected,
    ) = await asyncio.gather(
        get_personas(conn, list(all_persona_ids), redis, bypass_cache)
        if all_persona_ids
        else _empty_list(),
        get_rubrics(conn, rubric_ids_list, redis, bypass_cache)
        if rubric_ids_list
        else _empty_list(),
        get_scenario_time_limits(conn, time_limit_ids_list, redis, bypass_cache)
        if time_limit_ids_list
        else _empty_list(),
    )

    # Step 7: Derive standard_group_ids from rubrics
    all_standard_group_ids: set[UUID] = set()
    for r in rubrics_selected:
        if r.standard_group_ids:
            all_standard_group_ids.update(r.standard_group_ids)

    standard_group_ids_list = list(all_standard_group_ids)

    standard_groups_selected, standards_selected = await asyncio.gather(
        get_standard_groups(conn, standard_group_ids_list, redis, bypass_cache)
        if standard_group_ids_list
        else _empty_list(),
        search_standards(
            conn,
            redis,
            standard_group_ids=standard_group_ids_list,
            bypass_cache=bypass_cache,
        )
        if standard_group_ids_list
        else _empty_list(),
    )

    # Step 8: Return ArtifactContext
    return ArtifactContext(
        artifact_id=None,
        active=True,
        group_id=None,  # type: ignore[arg-type]
        draft_version=None,
        resources={
            "simulations": ResourcePair(selected=simulations_selected, suggestions=[]),
            "scenarios": ResourcePair(selected=scenarios_selected, suggestions=[]),
            "cohorts": ResourcePair(selected=cohorts_selected, suggestions=[]),
            "rubrics": ResourcePair(selected=rubrics_selected, suggestions=[]),
            "time_limits": ResourcePair(selected=time_limits_selected, suggestions=[]),
            "personas": ResourcePair(selected=personas_selected, suggestions=[]),
            "standard_groups": ResourcePair(
                selected=standard_groups_selected, suggestions=[]
            ),
            "standards": ResourcePair(selected=standards_selected, suggestions=[]),
        },
        entries={
            "homes": filtered_homes,
            "attempt_chats": all_attempt_chats,
            "attempts": all_attempts,
        },
    )


async def _empty_list() -> list:
    return []
