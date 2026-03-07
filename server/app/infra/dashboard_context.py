"""Resolve dashboard context — multi-phase data fetch + resource hydration.

Dashboard is a metrics endpoint with no artifact table and no drafts.
Two context resolvers:
  - resolve_dashboard_context: metrics bundle (header, primary, secondary, footer)
  - resolve_dashboard_search_context: history table (attempt list, paginated)

Both use attempt_chat_mv as the core data grain. Rubric scores and message
stats come from compiled SQL (no raw MV exists for those).
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.types import ArtifactContext, ResourcePair

# Compiled SQL (no raw MV alternative)
from app.routes.v5.api.main.dashboard.shared import (
    fetch_training_doc_ids,
    get_message_stats_internal,
    get_rubric_scores_internal,
)

# Entry fetchers
from app.routes.v5.tools.entries.attempt_chat.get import ChatItem
from app.routes.v5.tools.entries.attempt_chat.search import search_attempt_chats
from app.routes.v5.tools.entries.attempt_chat.types import GetAttemptChatResponse

# Resource get fetchers
from app.routes.v5.tools.resources.documents.get import get_documents
from app.routes.v5.tools.resources.fields.get import get_fields
from app.routes.v5.tools.resources.parameter_fields.get import get_parameter_fields
from app.routes.v5.tools.resources.parameters.get import get_parameters
from app.routes.v5.tools.resources.personas.get import get_personas
from app.routes.v5.tools.resources.profiles.get import get_profiles
from app.routes.v5.tools.resources.rubrics.get import get_rubrics
from app.routes.v5.tools.resources.scenarios.get import get_scenarios
from app.routes.v5.tools.resources.simulations.get import get_simulations
from app.routes.v5.tools.resources.standard_groups.get import get_standard_groups

# Settings
from app.utils.sql_helper import execute_sql_typed

ACTIVE_SETTINGS_SQL_PATH = "app/sql/queries/settings/get_active_settings_complete.sql"


def _to_chat_item(r: GetAttemptChatResponse) -> ChatItem:
    """Convert a GetAttemptChatResponse (raw MV row) to ChatItem."""
    return ChatItem(
        chat_id=r.chat_id,
        attempt_id=r.attempt_id,
        chat_entry_id=r.chat_entry_id,
        group_id=r.group_id,
        attempt_chat_id=r.chat_entry_id,  # attempt_chat_id = chat_entry_id
        profile_id=r.profile_id,
        cohort_id=r.cohort_id,
        department_id=r.department_id,
        simulation_id=r.simulation_id,
        scenario_id=r.scenario_id,
        persona_ids=r.persona_ids,
        rubric_id=r.rubric_id,
        grade_score=r.grade_score,
        grade_total_points=r.grade_total_points,
        grade_pass_points=r.grade_pass_points,
        grade_passed=r.grade_passed,
        grade_time_taken=r.grade_time_taken,
        completed=r.completed or False,
        attempt_number=r.attempt_number or 0,
        chat_created_at=r.chat_created_at,
        attempt_date=r.attempt_date,
        attempt_type=r.attempt_type,
        is_archived=r.is_archived or False,
        infinite_mode=r.infinite_mode or False,
    )


async def resolve_dashboard_context(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    target_profile_id: UUID | None = None,
    actor_profile_id: UUID | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
    attempt_type: str | None = None,
    is_archived: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve dashboard context for metrics bundle.

    Entries:
      - chat_items: ChatItem list (enriched with message stats + document_ids)
      - rubric_items: RubricScoreItem list
      - thresholds: [Thresholds] (single-item list)
      - scenario_counts: list of {simulation_id, scenario_count} records
      - cohort_names: list of {id, name} records

    Resources:
      - simulations, scenarios, personas, profiles, rubrics, standard_groups,
        documents, parameter_fields, parameters, fields
    """

    # ── Phase 1: Parallel fetch core data ────────────────────────────
    async def _fetch_chats():
        async with pool.acquire() as c:
            raw = await search_attempt_chats(
                c,
                profile_ids=[target_profile_id] if target_profile_id else None,
                cohort_ids=cohort_ids,
                department_ids=list(department_ids) if department_ids else None,
                simulation_ids=simulation_ids,
                attempt_type=attempt_type,
                is_archived=is_archived,
                date_from=date_from,
                date_to=date_to,
                limit=100000,
            )
        return [_to_chat_item(r) for r in raw]

    async def _fetch_rubric_scores():
        async with pool.acquire() as c:
            return await get_rubric_scores_internal(
                conn=c,
                profile_id=target_profile_id,
                cohort_ids=cohort_ids,
                department_ids=department_ids,
                simulation_ids=simulation_ids,
                attempt_type=attempt_type,
                is_archived=is_archived,
                date_from=date_from,
                date_to=date_to,
                bypass_cache=bypass_cache,
            )

    async def _fetch_thresholds():
        from app.sql.types import GetActiveSettingsSqlParams, GetActiveSettingsSqlRow

        profile_for_settings = actor_profile_id or target_profile_id
        success, warning, danger = 85, 80, 70
        if profile_for_settings:
            async with pool.acquire() as c:
                row = await execute_sql_typed(
                    c,
                    ACTIVE_SETTINGS_SQL_PATH,
                    params=GetActiveSettingsSqlParams(
                        profile_id=str(profile_for_settings),
                        department_id=(
                            str(department_ids[0]) if department_ids else None
                        ),
                    ),
                )
                if row:
                    settings = GetActiveSettingsSqlRow.model_validate(row)
                    success = settings.success_threshold or success
                    warning = settings.warning_threshold or warning
                    danger = settings.danger_threshold or danger
        return {"success": success, "warning": warning, "danger": danger}

    chat_items, rubric_scores_result, thresholds = await asyncio.gather(
        _fetch_chats(),
        _fetch_rubric_scores(),
        _fetch_thresholds(),
    )
    rubric_items = rubric_scores_result.items

    # ── Phase 2: Collect resource IDs from data ──────────────────────
    simulation_ids_set: set[UUID] = set()
    persona_ids_set: set[UUID] = set()
    cohort_ids_set: set[UUID] = set()
    scenario_ids_set: set[UUID] = set()
    attempt_chat_ids_set: set[UUID] = set()
    chat_ids: list[UUID] = []

    for item in chat_items:
        chat_ids.append(item.chat_id)
        if item.simulation_id:
            simulation_ids_set.add(item.simulation_id)
        if item.persona_ids:
            persona_ids_set.update(item.persona_ids)
        if item.cohort_id:
            cohort_ids_set.add(item.cohort_id)
        if item.scenario_id:
            scenario_ids_set.add(item.scenario_id)
        if item.attempt_chat_id:
            attempt_chat_ids_set.add(item.attempt_chat_id)

    rubric_ids_set: set[UUID] = set()
    for item in rubric_items:
        if item.rubric_id:
            rubric_ids_set.add(item.rubric_id)
        if item.simulation_id:
            simulation_ids_set.add(item.simulation_id)

    # ── Phase 3: Parallel resource hydration + enrichment data ───────
    async def _get_simulations():
        async with pool.acquire() as c:
            return await get_simulations(
                c, list(simulation_ids_set), redis, bypass_cache=bypass_cache
            )

    async def _get_personas():
        async with pool.acquire() as c:
            return await get_personas(
                c, list(persona_ids_set), redis, bypass_cache=bypass_cache
            )

    async def _get_scenarios():
        async with pool.acquire() as c:
            return await get_scenarios(
                c, list(scenario_ids_set), redis, bypass_cache=bypass_cache
            )

    async def _get_rubric_resources():
        async with pool.acquire() as c:
            rubrics = await get_rubrics(
                c, list(rubric_ids_set), redis, bypass_cache=bypass_cache
            )
        all_sg_ids: list[UUID] = []
        for rubric in rubrics:
            for sg_id in getattr(rubric, "standard_group_ids", None) or []:
                if sg_id and sg_id not in all_sg_ids:
                    all_sg_ids.append(sg_id)
        standard_groups = []
        if all_sg_ids:
            async with pool.acquire() as c:
                standard_groups = await get_standard_groups(
                    c, all_sg_ids, redis, bypass_cache=bypass_cache
                )
        return rubrics, standard_groups

    async def _get_message_stats():
        if not chat_ids:
            return {}
        async with pool.acquire() as c:
            return await get_message_stats_internal(
                c, chat_ids, bypass_cache=bypass_cache
            )

    async def _get_cohort_names():
        if not cohort_ids_set:
            return []
        async with pool.acquire() as c:
            return await c.fetch(
                "SELECT id, name FROM cohorts_resource WHERE id = ANY($1::uuid[])",
                list(cohort_ids_set),
            )

    async def _get_scenario_counts():
        if not simulation_ids_set:
            return []
        async with pool.acquire() as c:
            return await c.fetch(
                """
                SELECT simulation_id, COUNT(*)::int AS scenario_count
                FROM simulation_scenarios_junction
                WHERE simulation_id = ANY($1::uuid[]) AND active = true
                GROUP BY simulation_id
                """,
                list(simulation_ids_set),
            )

    async def _get_training_doc_ids():
        if not attempt_chat_ids_set:
            return {}
        async with pool.acquire() as c:
            return await fetch_training_doc_ids(
                c, list(attempt_chat_ids_set), bypass_cache=bypass_cache
            )

    async def _get_profiles():
        if not target_profile_id:
            return []
        async with pool.acquire() as c:
            return await get_profiles(
                c, [target_profile_id], redis, bypass_cache=bypass_cache
            )

    (
        simulations,
        personas,
        scenarios_list,
        (rubrics, standard_groups),
        message_stats,
        cohort_name_rows,
        scenario_count_rows,
        doc_map,
        target_profiles,
    ) = await asyncio.gather(
        _get_simulations(),
        _get_personas(),
        _get_scenarios(),
        _get_rubric_resources(),
        _get_message_stats(),
        _get_cohort_names(),
        _get_scenario_counts(),
        _get_training_doc_ids(),
        _get_profiles(),
    )

    # ── Phase 4: Enrich chat items ───────────────────────────────────
    for item in chat_items:
        stats = message_stats.get(item.chat_id)
        if stats:
            item.num_messages_total = stats.num_messages_total
            item.avg_response_sec = stats.avg_response_sec
        if item.attempt_chat_id:
            d_ids = doc_map.get(item.attempt_chat_id)
            if d_ids:
                item.document_ids = list(d_ids)

    # ── Phase 5: Sequential resource hydration (depends on Phase 3) ──
    # Documents from collected document_ids
    document_ids_set: set[UUID] = set()
    for item in chat_items:
        for doc_id in item.document_ids or []:
            document_ids_set.add(doc_id)

    async with pool.acquire() as c:
        documents = await get_documents(
            c, list(document_ids_set), redis, bypass_cache=bypass_cache
        )

    # Parameter fields from scenarios + personas + documents
    all_pf_ids: set[UUID] = set()
    for s in scenarios_list:
        for pfid in getattr(s, "parameter_field_ids", None) or []:
            all_pf_ids.add(pfid)
    for p in personas:
        for pfid in getattr(p, "parameter_field_ids", None) or []:
            all_pf_ids.add(pfid)
    for d in documents:
        for pfid in getattr(d, "parameter_field_ids", None) or []:
            all_pf_ids.add(pfid)

    async with pool.acquire() as c:
        parameter_fields = await get_parameter_fields(
            c, list(all_pf_ids), redis, bypass_cache=bypass_cache
        )

    # Parameters + fields from parameter_fields
    parameter_ids_set: set[UUID] = set()
    field_ids_set: set[UUID] = set()
    for pf in parameter_fields:
        if pf.parameter_id:
            parameter_ids_set.add(pf.parameter_id)
        if pf.field_id:
            field_ids_set.add(pf.field_id)

    async def _get_parameters():
        async with pool.acquire() as c:
            return await get_parameters(
                c, list(parameter_ids_set), redis, bypass_cache=bypass_cache
            )

    async def _get_fields():
        async with pool.acquire() as c:
            return await get_fields(
                c, list(field_ids_set), redis, bypass_cache=bypass_cache
            )

    parameters, fields_list = await asyncio.gather(
        _get_parameters(),
        _get_fields(),
    )

    # ── Phase 6: Return ArtifactContext ──────────────────────────────
    return ArtifactContext(
        artifact_id=None,
        active=True,
        group_id=None,  # type: ignore[arg-type]
        draft_version=None,
        entries={
            "chat_items": chat_items,
            "rubric_items": rubric_items,
            "thresholds": [thresholds],
            "scenario_counts": scenario_count_rows,
            "cohort_names": cohort_name_rows,
        },
        resources={
            "simulations": ResourcePair(selected=simulations, suggestions=[]),
            "scenarios": ResourcePair(selected=scenarios_list, suggestions=[]),
            "personas": ResourcePair(selected=personas, suggestions=[]),
            "rubrics": ResourcePair(selected=rubrics, suggestions=[]),
            "standard_groups": ResourcePair(selected=standard_groups, suggestions=[]),
            "documents": ResourcePair(selected=documents, suggestions=[]),
            "parameter_fields": ResourcePair(selected=parameter_fields, suggestions=[]),
            "parameters": ResourcePair(selected=parameters, suggestions=[]),
            "fields": ResourcePair(selected=fields_list, suggestions=[]),
            "profiles": ResourcePair(selected=target_profiles, suggestions=[]),
        },
    )


async def resolve_dashboard_search_context(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_resource_id: UUID | None = None,
    target_profile_id: UUID | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    practice: bool = False,
    scenario_ids: list[UUID] | None = None,
    infinite_mode: bool | None = None,
    show_archived: bool = False,
    sort_by: str = "date",
    sort_order: str = "desc",
    page: int = 0,
    page_size: int = 20,
    date_from: date | None = None,
    date_to: date | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve dashboard search context for history table.

    Entries:
      - attempts: paginated attempt_mv rows (via compiled SQL for filter options)
      - attempt_chats: ChatViewItem list for paginated attempts

    Resources:
      - simulations, scenarios, personas, profiles
    """
    from app.routes.v5.tools.entries.attempt.get import (
        ChatViewItem,
        get_attempt_chats_internal,
    )
    from app.routes.v5.tools.entries.attempt.search import get_attempt_list_internal

    if not profile_resource_id:
        return ArtifactContext(
            artifact_id=None,
            active=True,
            group_id=None,  # type: ignore[arg-type]
            draft_version=None,
            entries={"attempts": [], "attempt_chats": [], "attempt_list_result": []},
            resources={},
        )

    query_profile_id = target_profile_id or profile_resource_id
    page_offset = page * page_size

    # Step 1: Paginated attempts
    # get_attempt_list_internal expects datetime, not date
    dt_from = (
        datetime(date_from.year, date_from.month, date_from.day, tzinfo=UTC)
        if date_from
        else None
    )
    dt_to = (
        datetime(date_to.year, date_to.month, date_to.day, 23, 59, 59, tzinfo=UTC)
        if date_to
        else None
    )

    async with pool.acquire() as c:
        list_result = await get_attempt_list_internal(
            conn=c,
            profile_id_filter=query_profile_id,
            practice_filter=practice,
            is_archived_filter=(show_archived if practice else False),
            simulation_id_filter=None,
            cohort_ids=cohort_ids,
            department_ids=department_ids,
            scenario_ids_filter=scenario_ids,
            infinite_mode_filter=infinite_mode,
            date_from=dt_from,
            date_to=dt_to,
            sort_by=sort_by,
            sort_order=sort_order,
            page_limit=page_size,
            page_offset=page_offset,
            bypass_cache=bypass_cache,
        )

    # Step 2: Batch-fetch chats for paginated attempt_ids
    items = list_result.items or []
    paginated_ids = [item.attempt_id for item in items]

    chats: list[ChatViewItem] = []
    if paginated_ids:
        async with pool.acquire() as c:
            chats = await get_attempt_chats_internal(
                c, attempt_ids=paginated_ids, bypass_cache=bypass_cache
            )

    # Step 3: Collect resource IDs
    h_sim_ids: set[UUID] = set()
    h_profile_ids: set[UUID] = set()
    h_persona_ids: set[UUID] = set()
    h_scenario_ids: set[UUID] = set()

    chats_by_attempt: dict[UUID, list[ChatViewItem]] = {}
    for chat in chats:
        if chat.attempt_id:
            chats_by_attempt.setdefault(chat.attempt_id, []).append(chat)

    for item in items:
        if item.simulation_id:
            h_sim_ids.add(item.simulation_id)
        if item.profile_id:
            h_profile_ids.add(item.profile_id)
        attempt_chats = chats_by_attempt.get(item.attempt_id, [])
        for chat in attempt_chats:
            if chat.persona_ids:
                h_persona_ids.update(chat.persona_ids)
            if chat.scenario_id:
                h_scenario_ids.add(chat.scenario_id)
        if item.scenario_ids:
            h_scenario_ids.update(item.scenario_ids)

    # Step 4: Parallel resource hydration
    async def _h_sims():
        if not h_sim_ids:
            return []
        async with pool.acquire() as c:
            return await get_simulations(
                c, list(h_sim_ids), redis, bypass_cache=bypass_cache
            )

    async def _h_profiles():
        if not h_profile_ids:
            return []
        async with pool.acquire() as c:
            return await get_profiles(
                c, list(h_profile_ids), redis, bypass_cache=bypass_cache
            )

    async def _h_personas():
        if not h_persona_ids:
            return []
        async with pool.acquire() as c:
            return await get_personas(
                c, list(h_persona_ids), redis, bypass_cache=bypass_cache
            )

    async def _h_scenarios():
        if not h_scenario_ids:
            return []
        async with pool.acquire() as c:
            return await get_scenarios(
                c, list(h_scenario_ids), redis, bypass_cache=bypass_cache
            )

    h_sims, h_profs, h_pers, h_scens = await asyncio.gather(
        _h_sims(), _h_profiles(), _h_personas(), _h_scenarios()
    )

    return ArtifactContext(
        artifact_id=None,
        active=True,
        group_id=None,  # type: ignore[arg-type]
        draft_version=None,
        entries={
            "attempts": items,
            "attempt_chats": chats,
            "attempt_list_result": [list_result],
        },
        resources={
            "simulations": ResourcePair(selected=h_sims, suggestions=[]),
            "scenarios": ResourcePair(selected=h_scens, suggestions=[]),
            "personas": ResourcePair(selected=h_pers, suggestions=[]),
            "profiles": ResourcePair(selected=h_profs, suggestions=[]),
        },
    )
