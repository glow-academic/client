"""Cohort entry sync — pre-create home/practice + chat entries on cohort save.

Insert-only. No reads from _entry tables. No deactivation of old entries.
All entries from the same sync share a canonical created_at timestamp (set in SQL).
"""

import asyncio
from datetime import datetime
from typing import Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/sql/queries/entries/cohort_sync/sync_cohort_entries_complete.sql"

# Flag name → chat_entry column mapping (13 entries)
FLAG_NAME_TO_COLUMN: dict[str, str] = {
    "Audio Enabled": "audio_enabled",
    "Text Enabled": "text_enabled",
    "Hints Enabled": "hints_enabled",
    "Copy Paste Allowed": "copy_paste_allowed",
    "Show Images": "show_images",
    "Show Objectives": "show_objectives",
    "Show Problem Statement": "show_problem_statement",
    "Analyses Enabled": "analyses_enabled",
    "Improvements Enabled": "improvements_enabled",
    "Replacements Enabled": "replacements_enabled",
    "Strengths Enabled": "strengths_enabled",
    "Use Custom": "use_custom",
    "Use Previous": "use_previous",
}


class SyncCohortEntriesSqlParams(BaseModel):
    """SQL parameters for syncing cohort entries."""

    cohorts_resource_id: UUID
    department_ids: list[UUID]
    profile_ids: list[UUID]
    profile_persona_ids: list[UUID]
    simulations: list[tuple[Any, ...]]
    chats: list[tuple[Any, ...]]

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.cohorts_resource_id,
            self.department_ids,
            self.profile_ids,
            self.profile_persona_ids,
            self.simulations,
            self.chats,
        )


class SyncCohortEntriesSqlRow(BaseModel):
    """SQL row returned from syncing cohort entries."""

    entry_count: int | None = None


async def sync_cohort_entries(
    conn: asyncpg.Connection,
    cohorts_resource_id: UUID,
    simulation_ids: list[UUID],
    simulation_position_ids: list[UUID],
    simulation_availability_ids: list[UUID],
    department_ids: list[UUID],
    profile_ids: list[UUID],
    profile_persona_ids: list[UUID],
) -> int:
    """Sync cohort entries by pre-creating home/practice + chat entries.

    Three-pass approach:
    1. Fetch simulations to get scenario_ids and sub-resource IDs
    2. Parallel fetch all sub-resources
    3. Build composite tuples and call SQL function
    """
    from app.infra.globals import get_pool, get_redis_client
    from app.routes.v5.tools.resources.rubrics.get import get_rubrics_internal
    from app.routes.v5.tools.resources.scenario_flags.get import (
        get_scenario_flags,
    )
    from app.routes.v5.tools.resources.scenario_positions.get import (
        get_scenario_positions,
    )
    from app.routes.v5.tools.resources.scenario_rubrics.get import (
        get_scenario_rubrics,
    )
    from app.routes.v5.tools.resources.scenario_time_limits.get import (
        get_scenario_time_limits,
    )
    from app.routes.v5.tools.resources.scenarios.get import get_scenarios
    from app.routes.v5.tools.resources.simulation_availability.get import (
        get_simulation_availability,
    )
    from app.routes.v5.tools.resources.simulation_positions.get import (
        get_simulation_positions,
    )
    from app.routes.v5.tools.resources.simulations.get import get_simulations_internal
    from app.routes.v5.tools.resources.standards.search import search_standards_internal

    if not simulation_ids:
        return 0

    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # ── Pass 1: Fetch simulations ──
    simulations = await get_simulations_internal(
        conn, simulation_ids, bypass_cache=True
    )

    if not simulations:
        return 0

    # Collect all sub-resource IDs across simulations
    all_scenario_ids: list[UUID] = []
    all_scenario_rubric_ids: list[UUID] = []
    all_scenario_flag_ids: list[UUID] = []
    all_scenario_position_ids: list[UUID] = []
    all_scenario_time_limit_ids: list[UUID] = []

    for sim in simulations:
        all_scenario_ids.extend(UUID(s) for s in (sim.scenario_ids or []))
        all_scenario_rubric_ids.extend(UUID(s) for s in (sim.scenario_rubric_ids or []))
        all_scenario_flag_ids.extend(UUID(s) for s in (sim.scenario_flag_ids or []))
        all_scenario_position_ids.extend(
            UUID(s) for s in (sim.scenario_position_ids or [])
        )
        all_scenario_time_limit_ids.extend(
            UUID(s) for s in (sim.scenario_time_limit_ids or [])
        )

    # ── Pass 2a: Parallel fetch all sub-resources ──
    # Each fetch acquires its own connection from the pool to avoid
    # asyncpg "another operation is in progress" on concurrent queries.
    async def _fetch_scenarios() -> list[Any]:
        async with pool.acquire() as c:
            return await get_scenarios(c, all_scenario_ids, get_redis_client(), bypass_cache=True)

    async def _fetch_scenario_rubrics() -> list[Any]:
        async with pool.acquire() as c:
            return await get_scenario_rubrics(
                c, all_scenario_rubric_ids, get_redis_client(), bypass_cache=True
            )

    async def _fetch_scenario_flags() -> list[Any]:
        async with pool.acquire() as c:
            return await get_scenario_flags(
                c, all_scenario_flag_ids, get_redis_client(), bypass_cache=True
            )

    async def _fetch_scenario_positions() -> list[Any]:
        async with pool.acquire() as c:
            return await get_scenario_positions(
                c, all_scenario_position_ids, get_redis_client(), bypass_cache=True
            )

    async def _fetch_scenario_time_limits() -> list[Any]:
        async with pool.acquire() as c:
            return await get_scenario_time_limits(
                c, all_scenario_time_limit_ids, get_redis_client(), bypass_cache=True
            )

    async def _fetch_sim_positions() -> list[Any]:
        async with pool.acquire() as c:
            return await get_simulation_positions(
                c, simulation_position_ids, get_redis_client(), bypass_cache=True
            )

    async def _fetch_sim_availability() -> list[Any]:
        async with pool.acquire() as c:
            return await get_simulation_availability(
                c, simulation_availability_ids, get_redis_client(), bypass_cache=True
            )

    gather_results = await asyncio.gather(
        _fetch_scenarios(),
        _fetch_scenario_rubrics(),
        _fetch_scenario_flags(),
        _fetch_scenario_positions(),
        _fetch_scenario_time_limits(),
        _fetch_sim_positions(),
        _fetch_sim_availability(),
    )
    scenarios: list[Any] = cast(list[Any], gather_results[0])
    scenario_rubrics: list[Any] = cast(list[Any], gather_results[1])
    scenario_flags: list[Any] = cast(list[Any], gather_results[2])
    scenario_positions: list[Any] = cast(list[Any], gather_results[3])
    scenario_time_limits: list[Any] = cast(list[Any], gather_results[4])
    sim_positions: list[Any] = cast(list[Any], gather_results[5])
    sim_availability: list[Any] = cast(list[Any], gather_results[6])

    # ── Pass 2b: Resolve rubrics → standard_group_ids → standards ──
    # Collect all resolved rubric IDs (rubrics_resource.id) from scenario_rubrics
    all_rubric_ids: list[UUID] = []
    for sr in scenario_rubrics:
        if sr.rubric_id:
            all_rubric_ids.append(sr.rubric_id)
    all_rubric_ids = list(set(all_rubric_ids))

    rubrics: list[Any] = []
    standards: list[Any] = []
    if all_rubric_ids:
        async with pool.acquire() as rub_conn:
            rubrics = await get_rubrics_internal(
                rub_conn, all_rubric_ids, bypass_cache=True
            )

        # Collect all standard_group_ids from rubrics
        all_standard_group_ids: list[UUID] = []
        for rub in rubrics:
            if rub.standard_group_ids:
                all_standard_group_ids.extend(rub.standard_group_ids)
        all_standard_group_ids = list(set(all_standard_group_ids))

        if all_standard_group_ids:
            # Fetch all standards belonging to these groups via search internal
            async with pool.acquire() as std_conn:
                standards = await search_standards_internal(
                    std_conn,
                    standard_group_ids=all_standard_group_ids,
                    limit_count=10000,
                    bypass_cache=True,
                )

    # ── Pass 3: Build lookup dicts ──

    # scenario_id → scenario data
    scenario_map = {s.scenario_id: s for s in scenarios if s.scenario_id}

    # scenario_rubric_id → rubrics_resource.id (resolved)
    rubric_map: dict[UUID, UUID] = {}
    for r in scenario_rubrics:
        if r.id and r.rubric_id:
            rubric_map[r.id] = r.rubric_id

    # rubric_id → standard_group_ids
    rubric_sg_map: dict[UUID, list[UUID]] = {}
    for rub in rubrics:
        if rub.id and rub.standard_group_ids:
            rubric_sg_map[rub.id] = list(rub.standard_group_ids)

    # standard_group_id → list of standard_ids
    sg_standards_map: dict[UUID, list[UUID]] = {}
    for std in standards:
        if std.standard_group_id and std.standard_id:
            sg_standards_map.setdefault(std.standard_group_id, []).append(
                std.standard_id
            )

    # scenario_flag_id → {column_name: True}
    flag_map: dict[UUID, dict[str, bool]] = {}
    for f in scenario_flags:
        if f.id and f.name:
            col = FLAG_NAME_TO_COLUMN.get(f.name)
            if col:
                flag_map.setdefault(f.id, {})[col] = True

    # scenario_position_id → value (int)
    pos_map: dict[UUID, int] = {}
    for p in scenario_positions:
        if p.id and p.value is not None:
            pos_map[p.id] = p.value

    # scenario_time_limit_id → (seconds, negative)
    time_limit_map: dict[UUID, tuple[int | None, bool]] = {}
    for t in scenario_time_limits:
        if t.id:
            time_limit_map[t.id] = (t.time_limit_seconds, t.negative or False)

    # simulation_position_id → value (int)
    sim_pos_map: dict[UUID, int] = {}
    for p in sim_positions:
        if p.id and p.value is not None:
            sim_pos_map[p.id] = p.value

    # simulation_availability_id → (time, type)
    sim_avail_map: dict[UUID, tuple[str | None, str | None]] = {}
    for a in sim_availability:
        if a.id:
            sim_avail_map[a.id] = (a.time, a.type)

    # ── Build simulation tuples ──
    sim_tuples: list[tuple[Any, ...]] = []
    for sim in simulations:
        if not sim.simulation_id:
            continue

        # Resolve position from simulation_positions (keyed by simulation_id)
        resolved_position = 0
        for p in sim_positions:
            if p.simulation_id and UUID(str(p.simulation_id)) == sim.simulation_id:
                resolved_position = p.value or 0
                break

        # Resolve start/end times from availability
        start_time: datetime | None = None
        end_time: datetime | None = None
        for a in sim_availability:
            if a.simulation_id and UUID(str(a.simulation_id)) == sim.simulation_id:
                if a.type == "start":
                    start_time = (
                        a.time
                        if isinstance(a.time, datetime)
                        else (datetime.fromisoformat(a.time) if a.time else None)
                    )
                elif a.type == "end":
                    end_time = (
                        a.time
                        if isinstance(a.time, datetime)
                        else (datetime.fromisoformat(a.time) if a.time else None)
                    )

        # Resolve position and availability resource IDs for this simulation
        sim_pos_resource_ids = [
            p.id
            for p in sim_positions
            if p.simulation_id
            and UUID(str(p.simulation_id)) == sim.simulation_id
            and p.id
        ]
        sim_avail_resource_ids = [
            a.id
            for a in sim_availability
            if a.simulation_id
            and UUID(str(a.simulation_id)) == sim.simulation_id
            and a.id
        ]

        sim_tuples.append(
            (
                sim.simulation_id,
                sim.practice or False,
                resolved_position,
                start_time,
                end_time,
                sim_pos_resource_ids,
                sim_avail_resource_ids,
            )
        )

    # ── Build chat tuples ──
    chat_tuples: list[tuple[Any, ...]] = []
    for sim_idx, sim in enumerate(simulations):
        if not sim.simulation_id:
            continue

        sim_1based = sim_idx + 1
        scenario_ids_for_sim = [UUID(s) for s in (sim.scenario_ids or [])]
        scenario_rubric_ids_for_sim = [UUID(s) for s in (sim.scenario_rubric_ids or [])]
        scenario_flag_ids_for_sim = [UUID(s) for s in (sim.scenario_flag_ids or [])]
        scenario_position_ids_for_sim = [
            UUID(s) for s in (sim.scenario_position_ids or [])
        ]
        scenario_time_limit_ids_for_sim = [
            UUID(s) for s in (sim.scenario_time_limit_ids or [])
        ]

        for scenario_id in scenario_ids_for_sim:
            scenario = scenario_map.get(scenario_id)
            if not scenario:
                continue

            # Resolve rubric IDs (scenario_rubric_id → rubrics_resource.id)
            resolved_rubric_ids: list[UUID] = []
            for sr_id in scenario_rubric_ids_for_sim:
                resolved = rubric_map.get(sr_id)
                if resolved:
                    resolved_rubric_ids.append(resolved)

            # Resolve position
            chat_position = 0
            for sp_id in scenario_position_ids_for_sim:
                if sp_id in pos_map:
                    # Find position for THIS scenario
                    for p in scenario_positions:
                        if p.id == sp_id and p.scenario_id == scenario_id:
                            chat_position = p.value or 0
                            break

            # Resolve time limit
            chat_time_limit: int | None = None
            chat_negative_time = False
            for st_id in scenario_time_limit_ids_for_sim:
                if st_id in time_limit_map:
                    for t in scenario_time_limits:
                        if t.id == st_id and t.scenario_id == scenario_id:
                            chat_time_limit = t.time_limit_seconds
                            chat_negative_time = t.negative or False
                            break

            # Resolve flags (13 booleans)
            flag_bools: dict[str, bool] = {}
            for sf_id in scenario_flag_ids_for_sim:
                if sf_id in flag_map:
                    # Check if this flag belongs to this scenario
                    for f in scenario_flags:
                        if f.id == sf_id and f.scenario_id == scenario_id:
                            flag_bools.update(flag_map[sf_id])
                            break

            # Extract flag values with defaults
            audio_enabled = flag_bools.get("audio_enabled", True)
            text_enabled = flag_bools.get("text_enabled", True)
            hints_enabled = flag_bools.get("hints_enabled", True)
            copy_paste_allowed = flag_bools.get("copy_paste_allowed", True)
            show_images = flag_bools.get("show_images", True)
            show_objectives = flag_bools.get("show_objectives", True)
            show_problem_statement = flag_bools.get("show_problem_statement", True)
            analyses_enabled = flag_bools.get("analyses_enabled", True)
            improvements_enabled = flag_bools.get("improvements_enabled", True)
            replacements_enabled = flag_bools.get("replacements_enabled", True)
            strengths_enabled = flag_bools.get("strengths_enabled", True)
            use_custom = flag_bools.get("use_custom", False)
            use_previous = flag_bools.get("use_previous", False)

            # Content-enabled flags (from scenario)
            ps_enabled = scenario.problem_statement_enabled or False
            obj_enabled = scenario.objectives_enabled or False
            vid_enabled = scenario.video_enabled or False
            img_enabled = scenario.images_enabled or False
            q_enabled = scenario.questions_enabled or False

            # Generate flags
            # 5 mirrored: generate_X = X_enabled
            gen_ps = ps_enabled
            gen_obj = obj_enabled
            gen_vid = vid_enabled
            gen_img = img_enabled
            gen_q = q_enabled

            # 4 connection-based: generate_X = len(X_ids) > 0
            gen_personas = len(scenario.persona_ids or []) > 0
            gen_documents = len(scenario.document_ids or []) > 0
            gen_options = len(scenario.option_ids or []) > 0
            gen_param_fields = len(scenario.parameter_field_ids or []) > 0

            # 2 derived: generate_names = generate_descriptions = NOT all_others_true
            all_others = all(
                [
                    gen_ps,
                    gen_obj,
                    gen_vid,
                    gen_img,
                    gen_q,
                    gen_personas,
                    gen_documents,
                    gen_options,
                    gen_param_fields,
                ]
            )
            gen_names = not all_others
            gen_descriptions = not all_others

            # Scenario flag/position/time_limit resource IDs for this scenario
            chat_scenario_flag_ids = [
                f.id for f in scenario_flags if f.scenario_id == scenario_id and f.id
            ]
            chat_scenario_position_ids = [
                p.id
                for p in scenario_positions
                if p.scenario_id == scenario_id and p.id
            ]
            chat_scenario_time_limit_ids = [
                t.id
                for t in scenario_time_limits
                if t.scenario_id == scenario_id and t.id
            ]

            # Resolve standard_group_ids and standard_ids from rubrics
            chat_standard_group_ids: list[UUID] = []
            chat_standard_ids: list[UUID] = []
            for rub_id in resolved_rubric_ids:
                for sg_id in rubric_sg_map.get(rub_id, []):
                    if sg_id not in chat_standard_group_ids:
                        chat_standard_group_ids.append(sg_id)
                    for std_id in sg_standards_map.get(sg_id, []):
                        if std_id not in chat_standard_ids:
                            chat_standard_ids.append(std_id)

            chat_tuples.append(
                (
                    sim_1based,
                    scenario_id,
                    resolved_rubric_ids,
                    scenario.name or "",
                    scenario.description or "",
                    chat_position,
                    chat_time_limit,
                    chat_negative_time,
                    # 13 flag booleans
                    audio_enabled,
                    text_enabled,
                    hints_enabled,
                    copy_paste_allowed,
                    show_images,
                    show_objectives,
                    show_problem_statement,
                    analyses_enabled,
                    improvements_enabled,
                    replacements_enabled,
                    strengths_enabled,
                    use_custom,
                    use_previous,
                    # 5 content-enabled
                    ps_enabled,
                    obj_enabled,
                    vid_enabled,
                    img_enabled,
                    q_enabled,
                    # 11 generate flags
                    gen_ps,
                    gen_obj,
                    gen_vid,
                    gen_img,
                    gen_q,
                    gen_personas,
                    gen_documents,
                    gen_options,
                    gen_param_fields,
                    gen_names,
                    gen_descriptions,
                    # connection resource IDs
                    chat_scenario_flag_ids,
                    chat_scenario_position_ids,
                    chat_scenario_time_limit_ids,
                    list(scenario.persona_ids or []),
                    list(scenario.document_ids or []),
                    list(scenario.image_ids or []),
                    list(scenario.video_ids or []),
                    list(scenario.question_ids or []),
                    list(scenario.option_ids or []),
                    list(scenario.problem_statement_ids or []),
                    list(scenario.objective_ids or []),
                    list(scenario.parameter_field_ids or []),
                    chat_standard_group_ids,
                    chat_standard_ids,
                )
            )

    # ── Execute SQL ──
    params = SyncCohortEntriesSqlParams(
        cohorts_resource_id=cohorts_resource_id,
        department_ids=department_ids or [],
        profile_ids=profile_ids or [],
        profile_persona_ids=profile_persona_ids or [],
        simulations=sim_tuples,
        chats=chat_tuples,
    )

    result = cast(
        SyncCohortEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    return result.entry_count if result and result.entry_count else 0
