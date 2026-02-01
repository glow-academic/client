"""Attempt detail endpoint - POST /attempt/get.

Unified endpoint for both home and practice attempt detail, differentiated by
`practice: bool` parameter. Uses view internal handlers with parallel query
execution:
1. Query 1 (Attempt): Attempt-level data via simulation_attempts view
2. Query 2 (Chats): Chat-level data via simulation_chats view
3. Query 3 (Messages): Message-level data via simulation_messages view

All three queries run in parallel using pool.acquire() for each,
then results are assembled in Python.
"""

import asyncio
import json
from collections import defaultdict
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.attempt.permissions import (
    check_attempt_access,
    compute_content_display,
)
from app.api.v4.artifacts.attempt.types import (
    AggregatedResults,
    AttemptData,
    ChatData,
    ContentEntry,
    DocumentEntry,
    FeedbackEntry,
    GetAttemptDetailRequest,
    GetAttemptDetailResponse,
    GradeData,
    GradingStateData,
    HighlightEntry,
    HintEntry,
    HintsByMessage,
    ImageEntry,
    ImprovementEntry,
    MessageData,
    ObjectiveEntry,
    OptionEntry,
    PersonaEntry,
    ProblemStatementEntry,
    QuestionEntry,
    QuizResponse,
    ReplacementEntry,
    RubricEntry,
    RubricStructureData,
    ScenarioDocumentEntry,
    ScenarioEntry,
    SimulationData,
    StandardAchievement,
    StandardEntry,
    StandardFeedback,
    StandardGroupEntry,
    StandardGroupMapping,
    StandardGroupStandards,
    StandardMapping,
    StandardPass,
    StrengthEntry,
    TemplateEntry,
    TimerData,
    VideoEntry,
)
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.images.get import get_images_internal
from app.api.v4.resources.objectives.get import get_objectives_internal
from app.api.v4.resources.options.get import get_options_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.problem_statements.get import get_problem_statements_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.questions.get import get_questions_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_batch_internal
from app.api.v4.resources.standard_groups.get import get_standard_groups_internal
from app.api.v4.resources.standards.get import get_standards_internal
from app.api.v4.resources.templates.get import get_templates_internal
from app.api.v4.resources.videos.get import get_videos_internal
from app.api.v4.views.simulation.attempts.get import get_simulation_attempts_internal
from app.api.v4.views.simulation.chats.get import get_simulation_chats_internal
from app.api.v4.views.simulation.messages.get import get_simulation_messages_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


def _format_timer(elapsed: int, limit_seconds: int | None, infinite_mode: bool) -> TimerData:
    """Format timer data.

    Args:
        elapsed: Elapsed time in seconds
        limit_seconds: Time limit in seconds (not minutes)
        infinite_mode: Whether the attempt is in infinite mode
    """
    if limit_seconds is None or limit_seconds == 0:
        return TimerData(
            elapsed=elapsed,
            limit=None,
            exceeded=False,
            formatted="",
        )

    remaining = max(limit_seconds - elapsed, 0)
    exceeded = remaining <= 0 if infinite_mode else elapsed > limit_seconds

    hours = remaining // 3600
    minutes = (remaining % 3600) // 60
    seconds = remaining % 60
    formatted = f"{hours}h {minutes}m {seconds}s"

    return TimerData(
        elapsed=elapsed,
        limit=limit_seconds,
        exceeded=exceeded,
        formatted=formatted,
    )


@router.post(
    "/get",
    response_model=GetAttemptDetailResponse,
    dependencies=[
        audit_activity("attempt.get", "{{ actor.name }} viewed attempt detail")
    ],
)
async def attempt_get(
    request: GetAttemptDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptDetailResponse:
    """Get attempt detail with parallel MV fetching.

    Unified endpoint for home and practice attempt detail, differentiated by
    `practice: bool` parameter.

    Uses view internal handlers with pool-based parallel fetch:
    - View 1: simulation_attempts (attempt-level aggregates)
    - View 2: simulation_chats (chat-level data with grades/feedbacks)
    - View 3: simulation_messages (message-level data with strengths/improvements/hints)

    Each query runs on its own connection from the pool for true parallelism.
    """
    practice = request.practice
    tags = ["attempt", "practice" if practice else "home"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetAttemptDetailResponse.model_validate(cached["data"])

    try:
        # Get profile_id from header and convert to UUID
        profile_id_str = http_request.state.profile_id
        if not profile_id_str:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )
        profile_id = UUID(profile_id_str)

        attempt_id = request.attempt_id

        # Resolve profile_id (artifact) to profiles_id (resource) for MV comparison
        profiles_id = await conn.fetchval(
            """
            SELECT profiles_id FROM profile_profiles_junction
            WHERE profile_id = $1 AND active = true
            LIMIT 1
            """,
            profile_id,
        )

        # Get pool for parallel queries
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # === PARALLEL FETCH FUNCTIONS ===
        # Each function acquires its own connection for true parallelism

        async def fetch_attempt(aid: UUID, pid: UUID) -> Any:
            async with pool.acquire() as c:
                # Use view internal handler with practice flag
                return await get_simulation_attempts_internal(
                    conn=c,
                    attempt_ids=[aid],
                    practice=practice,
                    profile_id=pid,
                    bypass_cache=bypass_cache,
                )

        async def fetch_chats(aid: UUID) -> Any:
            async with pool.acquire() as c:
                # Use view internal handler with practice flag
                return await get_simulation_chats_internal(
                    conn=c,
                    attempt_id=aid,
                    practice=practice,
                    bypass_cache=bypass_cache,
                )

        async def fetch_messages(aid: UUID) -> Any:
            async with pool.acquire() as c:
                # Use view internal handler with practice flag
                # This includes hints when practice=True
                return await get_simulation_messages_internal(
                    conn=c,
                    attempt_id=aid,
                    practice=practice,
                    bypass_cache=bypass_cache,
                )

        async def fetch_simulation_config(sim_id: UUID) -> dict[str, Any]:
            """Fetch simulation flags and config from the flags tables."""
            async with pool.acquire() as c:
                # Get simulation flags
                flags_rows = await c.fetch(
                    """
                    SELECT f.name, sf.value
                    FROM simulation_flags_junction sf
                    JOIN flags_resource f ON sf.flag_id = f.id
                    WHERE sf.simulation_id = $1
                    """,
                    sim_id,
                )
                flags = {row["name"]: row["value"] for row in flags_rows}

                # Get rubric_id (from first chat's rubric connection via attempt)
                rubric_id = await c.fetchval(
                    """
                    SELECT scr.rubrics_id
                    FROM simulation_attempts_simulations_connection sas
                    JOIN simulation_chats_entry ch ON ch.attempt_id = (
                        SELECT sa.id FROM simulation_attempts_entry sa
                        JOIN simulation_attempts_simulations_connection sas2 ON sas2.attempt_id = sa.id
                        WHERE sas2.simulations_id = $1 AND sas2.active = true
                        LIMIT 1
                    )
                    JOIN simulation_chats_rubrics_connection scr ON scr.chat_id = ch.id AND scr.active = true
                    WHERE sas.simulations_id = $1 AND sas.active = true
                    LIMIT 1
                    """,
                    sim_id,
                )

                # Get time_limit (sum of scenario time limits)
                time_limit = await c.fetchval(
                    """
                    SELECT COALESCE(
                        SUM(stlr.time_limit_seconds),
                        0
                    )::int
                    FROM simulation_scenario_time_limits_junction sstl
                    JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
                    WHERE sstl.simulation_id = $1
                      AND sstl.active = true
                      AND stlr.active = true
                    """,
                    sim_id,
                )

                return {
                    "practice_simulation": flags.get("practice", False),
                    "hints_enabled": flags.get("hints", False),
                    "objectives_enabled": flags.get("objectives", True),
                    "image_input_active": flags.get("image_input", False),
                    "copy_paste_allowed": flags.get("copy_paste", False),
                    "rubric_id": rubric_id,
                    "time_limit": time_limit,
                }

        async def fetch_scenario_documents(sim_id: UUID) -> list[dict[str, Any]]:
            """Fetch scenario documents for the simulation."""
            async with pool.acquire() as c:
                rows = await c.fetch(
                    """
                    SELECT DISTINCT
                        d.id as document_id,
                        COALESCE(d.name, '') as name,
                        COALESCE(d.description, '') as description,
                        d.created_at as updated_at,
                        dur.uploads_id as upload_id
                    FROM simulation_scenarios_junction ss
                    JOIN scenario_documents_junction sd ON sd.scenario_id = ss.scenario_id AND sd.active = true
                    JOIN documents_resource d ON d.id = sd.document_id AND d.active = true
                    LEFT JOIN document_uploads_resource dur ON dur.document_id = d.id AND dur.active = true
                    WHERE ss.simulation_id = $1
                      AND ss.active = true
                    ORDER BY d.created_at DESC
                    """,
                    sim_id,
                )
                return [dict(row) for row in rows]

        async def fetch_rubric_structure(rubric_id: UUID | None) -> dict[str, Any] | None:
            """Fetch rubric structure for the simulation."""
            if not rubric_id:
                return None
            async with pool.acquire() as c:
                # Get standard groups with their standard IDs
                # Standards belong to groups via standard_group_id on standards_resource
                sg_rows = await c.fetch(
                    """
                    SELECT
                        sg.id as standard_group_id,
                        sg.name,
                        sg.description,
                        sg.points,
                        sg.pass_points,
                        ARRAY_AGG(DISTINCT s.id::text) FILTER (WHERE s.id IS NOT NULL) as standard_ids
                    FROM rubric_standard_groups_junction rsg
                    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id AND sg.active = true
                    LEFT JOIN standards_resource s ON s.standard_group_id = sg.id AND s.active = true
                    WHERE rsg.rubrics_id = $1
                      AND rsg.active = true
                    GROUP BY sg.id, sg.name, sg.description, sg.points, sg.pass_points
                    """,
                    rubric_id,
                )

                # Get standards mapping
                std_rows = await c.fetch(
                    """
                    SELECT DISTINCT
                        s.id as standard_id,
                        s.name,
                        s.description,
                        s.points
                    FROM rubric_standard_groups_junction rsg
                    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id AND sg.active = true
                    JOIN standards_resource s ON s.standard_group_id = sg.id AND s.active = true
                    WHERE rsg.rubrics_id = $1
                      AND rsg.active = true
                    """,
                    rubric_id,
                )

                return {
                    "standard_groups": [
                        {
                            "standard_group_id": row["standard_group_id"],
                            "standard_ids": row["standard_ids"] or [],
                        }
                        for row in sg_rows
                    ],
                    "standard_groups_mapping": [
                        {
                            "standard_group_id": row["standard_group_id"],
                            "name": row["name"],
                            "description": row["description"],
                            "points": row["points"],
                            "pass_points": row["pass_points"],
                        }
                        for row in sg_rows
                    ],
                    "standards_mapping": [
                        {
                            "standard_id": row["standard_id"],
                            "name": row["name"],
                            "description": row["description"],
                            "points": row["points"],
                        }
                        for row in std_rows
                    ],
                }

        async def fetch_resource_metadata(
            image_ids: list[UUID],
            video_ids: list[UUID],
            document_ids: list[UUID],
            template_ids: list[UUID],
            persona_ids: list[UUID],
            objective_ids: list[UUID],
            question_ids: list[UUID],
            option_ids: list[UUID],
            problem_statement_ids: list[UUID],
            scenario_ids: list[UUID],
            rubric_ids: list[UUID],
            standard_group_ids: list[UUID],
            standard_ids: list[UUID],
        ) -> dict[str, dict[UUID, dict]]:
            """Fetch resource metadata using internal handlers (with caching).

            Uses the same internal fetch functions as the resources endpoints,
            which provide caching and consistent data access patterns.
            """
            result: dict[str, dict[UUID, dict]] = {
                "images": {},
                "videos": {},
                "documents": {},
                "templates": {},
                "personas": {},
                "objectives": {},
                "questions": {},
                "options": {},
                "problem_statements": {},
                "scenarios": {},
                "rubrics": {},
                "standard_groups": {},
                "standards": {},
            }

            async with pool.acquire() as c:
                # Fetch images
                if image_ids:
                    items = await get_images_internal(c, image_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.image_id:
                            result["images"][item.image_id] = {
                                "name": item.name,
                                "description": item.description,
                                "upload_id": item.upload_id,
                            }

                # Fetch videos
                if video_ids:
                    items = await get_videos_internal(c, video_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.video_id:
                            result["videos"][item.video_id] = {
                                "name": item.name,
                                "description": item.description,
                                "upload_id": item.upload_id,
                            }

                # Fetch documents
                if document_ids:
                    items = await get_documents_internal(c, document_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.document_id:
                            result["documents"][item.document_id] = {
                                "name": item.name,
                                "description": item.description,
                                "upload_id": item.upload_id,
                            }

                # Fetch templates
                if template_ids:
                    items = await get_templates_internal(c, template_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.template_id:
                            result["templates"][item.template_id] = {
                                "name": item.name,
                                "description": item.description,
                            }

                # Fetch personas
                if persona_ids:
                    items = await get_personas_internal(c, persona_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.persona_id:
                            result["personas"][item.persona_id] = {
                                "name": item.name,
                                "icon": item.icon,
                                "color": item.color,
                            }

                # Fetch objectives
                if objective_ids:
                    items = await get_objectives_internal(c, objective_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.objective_id:
                            result["objectives"][item.objective_id] = {
                                "objective": item.objective,
                            }

                # Fetch questions
                if question_ids:
                    items = await get_questions_internal(c, question_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.question_id:
                            result["questions"][item.question_id] = {
                                "question_text": item.question_text,
                                "allow_multiple": item.allow_multiple,
                            }

                # Fetch options
                if option_ids:
                    items = await get_options_internal(c, option_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.option_id:
                            result["options"][item.option_id] = {
                                "option_text": item.option_text,
                                "is_correct": item.is_correct,
                            }

                # Fetch problem statements
                if problem_statement_ids:
                    items = await get_problem_statements_internal(c, problem_statement_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.problem_statement_id:
                            result["problem_statements"][item.problem_statement_id] = {
                                "problem_statement": item.problem_statement,
                            }

                # Fetch scenarios
                if scenario_ids:
                    items = await get_scenarios_internal(c, scenario_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.scenario_id:
                            result["scenarios"][item.scenario_id] = {
                                "name": item.name,
                                "description": item.description,
                            }

                # Fetch rubrics
                if rubric_ids:
                    items = await get_rubrics_batch_internal(c, rubric_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.rubric_id:
                            result["rubrics"][item.rubric_id] = {
                                "name": item.name,
                                "description": item.description,
                                "total_points": item.total_points,
                                "pass_points": item.pass_points,
                            }

                # Fetch standard_groups
                if standard_group_ids:
                    items = await get_standard_groups_internal(c, standard_group_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.standard_group_id:
                            result["standard_groups"][item.standard_group_id] = {
                                "name": item.name,
                                "description": item.description,
                                "points": item.points,
                                "pass_points": item.pass_points,
                            }

                # Fetch standards
                if standard_ids:
                    items = await get_standards_internal(c, standard_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.standard_id:
                            result["standards"][item.standard_id] = {
                                "name": item.name,
                                "description": item.description,
                                "points": item.points,
                                "standard_group_id": item.standard_group_id,
                            }

            return result

        async def fetch_chat_extended_data(chat_ids: list[UUID]) -> dict[UUID, dict[str, Any]]:
            """Fetch extended data for chats: grading_state and hints.

            Note: Personas are now fetched via get_personas_internal using persona_ids from MV.
            """
            if not chat_ids:
                return {}
            async with pool.acquire() as c:
                result: dict[UUID, dict[str, Any]] = {cid: {} for cid in chat_ids}

                # Fetch grading state for completed chats
                grading_rows = await c.fetch(
                    """
                    SELECT
                        g.chat_id,
                        g.description as grade_description,
                        COALESCE(
                            (SELECT json_agg(json_build_object('standard_id', fsc.standard_id, 'achieved', true))
                             FROM simulation_feedbacks_entry f
                             JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = f.id AND fsc.active = true
                             WHERE f.grade_id = g.id AND f.active = true),
                            '[]'::json
                        ) as achieved_standards,
                        COALESCE(
                            (SELECT json_agg(json_build_object('standard_id', fsc.standard_id, 'passed', f.total >= COALESCE(sg.pass_points, 0)))
                             FROM simulation_feedbacks_entry f
                             JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = f.id AND fsc.active = true
                             LEFT JOIN standards_resource s ON s.id = fsc.standard_id AND s.active = true
                             LEFT JOIN standard_groups_resource sg ON sg.id = s.standard_group_id AND sg.active = true
                             WHERE f.grade_id = g.id AND f.active = true),
                            '[]'::json
                        ) as passed_standards,
                        COALESCE(
                            (SELECT json_agg(json_build_object('standard_id', fsc.standard_id, 'feedback', f.feedback))
                             FROM simulation_feedbacks_entry f
                             JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = f.id AND fsc.active = true
                             WHERE f.grade_id = g.id AND f.active = true),
                            '[]'::json
                        ) as feedback_by_standard_id
                    FROM simulation_grades_entry g
                    WHERE g.chat_id = ANY($1) AND g.active = true
                    """,
                    chat_ids,
                )
                for row in grading_rows:
                    chat_id = row["chat_id"]
                    result[chat_id]["grading_state"] = {
                        "achieved_standards": row["achieved_standards"],
                        "passed_standards": row["passed_standards"],
                        "grade_description": row["grade_description"],
                        "feedback_by_standard_id": row["feedback_by_standard_id"],
                    }

                # Fetch hints grouped by message
                hints_rows = await c.fetch(
                    """
                    SELECT
                        m.chat_id,
                        m.id as message_id,
                        json_agg(json_build_object(
                            'hint', h.hint,
                            'idx', h.idx
                        ) ORDER BY h.idx) as hints
                    FROM simulation_hints_entry h
                    JOIN simulation_messages_entry m ON m.id = h.message_id
                    WHERE m.chat_id = ANY($1) AND h.active = true
                    GROUP BY m.chat_id, m.id
                    """,
                    chat_ids,
                )
                for row in hints_rows:
                    chat_id = row["chat_id"]
                    if "hints" not in result[chat_id]:
                        result[chat_id]["hints"] = []
                    result[chat_id]["hints"].append({
                        "message_id": row["message_id"],
                        "hints": row["hints"],
                    })

                return result

        # === EXECUTE ALL QUERIES IN PARALLEL ===
        # First batch: attempt, chats, messages (needed to get simulation_id and chat_ids)
        attempt_result, chats_result, messages_result = await asyncio.gather(
            fetch_attempt(attempt_id, profile_id),
            fetch_chats(attempt_id),
            fetch_messages(attempt_id),
        )

        # Handle empty results
        if not attempt_result:
            return GetAttemptDetailResponse(
                attempt_exists=False,
                access_denied=True,
                actor_name=None,
            )

        attempt_item = attempt_result[0] if attempt_result else None

        if not attempt_item:
            return GetAttemptDetailResponse(
                attempt_exists=False,
                access_denied=True,
                actor_name=None,
            )

        # === FETCH SIMULATION AND PROFILE METADATA ===
        # These are now fetched via internal handlers instead of SQL JOINs
        simulation_name: str | None = None
        profile_name: str | None = None

        async def fetch_simulation_meta(sim_id: UUID | None) -> str | None:
            if not sim_id:
                return None
            async with pool.acquire() as c:
                items = await get_simulations_batch_internal(c, [sim_id], bypass_cache=bypass_cache)
                if items and items[0].title:
                    return items[0].title
            return None

        async def fetch_profile_meta(prof_id: UUID | None) -> str | None:
            if not prof_id:
                return None
            async with pool.acquire() as c:
                items = await get_profiles_internal(c, [prof_id], bypass_cache=bypass_cache)
                if items and items[0].name:
                    return items[0].name
            return None

        # Fetch simulation and profile names in parallel
        simulation_name, profile_name = await asyncio.gather(
            fetch_simulation_meta(attempt_item.simulation_id),
            fetch_profile_meta(attempt_item.profile_id),
        )

        # Check if profile matches (permission check)
        # Note: attempt_item.profile_id is profiles_id (resource), so compare with profiles_id
        if not check_attempt_access(attempt_item.profile_id, profiles_id):
            return GetAttemptDetailResponse(
                attempt_exists=True,
                access_denied=True,
                actor_name=profile_name,
            )

        # Set audit context
        if profile_name:
            audit_set(
                http_request,
                actor={"name": profile_name, "id": profile_id},
            )

        # === SECOND BATCH: Fetch extended data ===
        # Now that we have simulation_id and chat_ids, fetch extended data
        simulation_id = attempt_item.simulation_id
        chat_ids = [c.chat_id for c in (chats_result or [])]

        # Helper for empty async results
        async def empty_dict() -> dict[str, Any]:
            return {}

        async def empty_list() -> list[Any]:
            return []

        sim_config: dict[str, Any] = {}
        scenario_docs_raw: list[dict[str, Any]] = []
        chat_extended: dict[UUID, dict[str, Any]] = {}

        if simulation_id or chat_ids:
            tasks = []
            task_names = []

            if simulation_id:
                tasks.append(fetch_simulation_config(simulation_id))
                task_names.append("sim_config")
                tasks.append(fetch_scenario_documents(simulation_id))
                task_names.append("scenario_docs")
            else:
                tasks.append(empty_dict())
                task_names.append("sim_config")
                tasks.append(empty_list())
                task_names.append("scenario_docs")

            if chat_ids:
                tasks.append(fetch_chat_extended_data(chat_ids))
                task_names.append("chat_extended")
            else:
                tasks.append(empty_dict())
                task_names.append("chat_extended")

            results = await asyncio.gather(*tasks)
            for i, name in enumerate(task_names):
                if name == "sim_config":
                    sim_config = results[i] or {}
                elif name == "scenario_docs":
                    scenario_docs_raw = results[i] or []
                elif name == "chat_extended":
                    chat_extended = results[i] or {}

        # Now fetch rubric structure with the rubric_id from sim_config
        rubric_struct_raw: dict[str, Any] | None = None
        rubric_id = sim_config.get("rubric_id") if sim_config else None
        if rubric_id:
            rubric_struct_raw = await fetch_rubric_structure(rubric_id)

        # === GROUP MESSAGES BY CHAT_ID ===
        messages_by_chat: dict[UUID, list[Any]] = defaultdict(list)
        for msg in messages_result or []:
            messages_by_chat[msg.chat_id].append(msg)

        # === COLLECT AND ENRICH RESOURCE REFS ===
        # Collect all unique resource IDs from chats
        all_image_ids: list[UUID] = []
        all_video_ids: list[UUID] = []
        all_document_ids: list[UUID] = []
        all_template_ids: list[UUID] = []
        all_persona_ids: list[UUID] = []
        all_objective_ids: list[UUID] = []
        all_question_ids: list[UUID] = []
        all_option_ids: list[UUID] = []
        all_problem_statement_ids: list[UUID] = []
        all_scenario_ids: list[UUID] = []
        all_rubric_ids: list[UUID] = []
        all_standard_group_ids: list[UUID] = []
        all_standard_ids: list[UUID] = []

        for chat_item in chats_result or []:
            if chat_item.image_ids:
                all_image_ids.extend(chat_item.image_ids)
            if chat_item.video_ids:
                all_video_ids.extend(chat_item.video_ids)
            if chat_item.document_ids:
                all_document_ids.extend(chat_item.document_ids)
            if chat_item.template_ids:
                all_template_ids.extend(chat_item.template_ids)
            if chat_item.persona_ids:
                all_persona_ids.extend(chat_item.persona_ids)
            if chat_item.objective_ids:
                all_objective_ids.extend(chat_item.objective_ids)
            if chat_item.question_ids:
                all_question_ids.extend(chat_item.question_ids)
            if chat_item.option_ids:
                all_option_ids.extend(chat_item.option_ids)
            if chat_item.problem_statement_id:
                all_problem_statement_ids.append(chat_item.problem_statement_id)
            if chat_item.scenario_id:
                all_scenario_ids.append(chat_item.scenario_id)
            if chat_item.rubric_id:
                all_rubric_ids.append(chat_item.rubric_id)
            if chat_item.standard_group_ids:
                all_standard_group_ids.extend(chat_item.standard_group_ids)
            if chat_item.standard_ids:
                all_standard_ids.extend(chat_item.standard_ids)

        # Fetch metadata for all resources
        resource_meta = await fetch_resource_metadata(
            image_ids=list(set(all_image_ids)),
            video_ids=list(set(all_video_ids)),
            document_ids=list(set(all_document_ids)),
            template_ids=list(set(all_template_ids)),
            persona_ids=list(set(all_persona_ids)),
            objective_ids=list(set(all_objective_ids)),
            question_ids=list(set(all_question_ids)),
            option_ids=list(set(all_option_ids)),
            problem_statement_ids=list(set(all_problem_statement_ids)),
            scenario_ids=list(set(all_scenario_ids)),
            rubric_ids=list(set(all_rubric_ids)),
            standard_group_ids=list(set(all_standard_group_ids)),
            standard_ids=list(set(all_standard_ids)),
        )

        # === BUILD CHATS WITH MESSAGES ===
        chats: list[ChatData] = []
        for chat_item in chats_result or []:
            chat_messages = messages_by_chat.get(chat_item.chat_id, [])

            # Transform messages
            messages: list[MessageData] = []
            for msg in chat_messages:
                # Transform strengths
                strengths: list[StrengthEntry] = []
                if msg.strengths:
                    for s in msg.strengths:
                        highlights: list[HighlightEntry] = []
                        if s.highlights:
                            for h in s.highlights:
                                highlights.append(
                                    HighlightEntry(section=h.section, idx=h.idx)
                                )
                        strengths.append(
                            StrengthEntry(
                                id=s.id,
                                message_id=s.message_id,
                                name=s.name,
                                description=s.description,
                                highlights=highlights,
                            )
                        )

                # Transform improvements
                improvements: list[ImprovementEntry] = []
                if msg.improvements:
                    for i in msg.improvements:
                        replacements: list[ReplacementEntry] = []
                        if i.replacements:
                            for r in i.replacements:
                                replacements.append(
                                    ReplacementEntry(
                                        section=r.section,
                                        replace_text=r.replace_text,
                                        idx=r.idx,
                                    )
                                )
                        improvements.append(
                            ImprovementEntry(
                                id=i.id,
                                message_id=i.message_id,
                                name=i.name,
                                description=i.description,
                                replacements=replacements,
                            )
                        )

                # Transform hints (practice mode only)
                hints: list[HintEntry] | None = None
                if practice and msg.hints:
                    hints = []
                    for h in msg.hints:
                        hints.append(
                            HintEntry(
                                message_id=h.message_id,
                                hint=h.hint,
                                idx=h.idx,
                            )
                        )

                # Transform contents with computed display fields
                # is_own_attempt is True if we passed the access check (profile IDs match)
                is_own_attempt = attempt_item.profile_id == profiles_id
                contents: list[ContentEntry] | None = None
                if msg.contents:
                    contents = []
                    for c in msg.contents:
                        name, color, icon = compute_content_display(
                            message_type=msg.type,
                            profile_name=c.profile_name,
                            persona_name=c.persona_name,
                            persona_color=c.persona_color,
                            persona_icon=c.persona_icon,
                            is_own_attempt=is_own_attempt,
                        )
                        contents.append(
                            ContentEntry(
                                id=c.id,
                                content=c.content,
                                name=name,
                                color=color,
                                icon=icon,
                                created_at=(
                                    c.created_at.isoformat() if c.created_at else None
                                ),
                            )
                        )

                messages.append(
                    MessageData(
                        id=msg.message_id,
                        content=msg.content,
                        type=msg.type,
                        created_at=(
                            msg.created_at.isoformat() if msg.created_at else None
                        ),
                        completed=msg.completed,
                        contents=contents,
                        strengths=strengths,
                        improvements=improvements,
                        hints=hints,  # Only populated when practice=True
                    )
                )

            # Build grade data
            grade = None
            # Build grade from chat grade composite + rubric metadata for points
            if chat_item.grade:
                rubric_meta = resource_meta["rubrics"].get(chat_item.rubric_id, {}) if chat_item.rubric_id else {}
                grade = GradeData(
                    score=chat_item.grade.score,
                    passed=chat_item.grade.passed,
                    description=chat_item.grade.description,
                    time_taken=chat_item.grade.time_taken,
                    total_points=rubric_meta.get("total_points"),
                    pass_points=rubric_meta.get("pass_points"),
                )

            # Transform feedbacks (with standard_group_id from standards metadata)
            feedbacks: list[FeedbackEntry] = []
            if chat_item.feedbacks:
                for fb in chat_item.feedbacks:
                    # Look up standard_group_id from standards metadata
                    std_group_id = None
                    if fb.standard_id:
                        std_meta = resource_meta["standards"].get(fb.standard_id, {})
                        std_group_id = std_meta.get("standard_group_id")
                    feedbacks.append(
                        FeedbackEntry(
                            id=fb.id,
                            standard_id=fb.standard_id,
                            standard_group_id=std_group_id,
                            total=fb.total,
                            feedback=fb.feedback,
                        )
                    )

            # Get extended data for this chat (grading state, hints)
            chat_ext = chat_extended.get(chat_item.chat_id, {}) if chat_extended else {}

            # Build grading state
            grading_state_data: GradingStateData | None = None
            if chat_ext.get("grading_state"):
                gs = chat_ext["grading_state"]
                # Parse JSON if returned as string
                achieved_raw = gs.get("achieved_standards") or []
                if isinstance(achieved_raw, str):
                    achieved_raw = json.loads(achieved_raw)
                passed_raw = gs.get("passed_standards") or []
                if isinstance(passed_raw, str):
                    passed_raw = json.loads(passed_raw)
                fb_raw = gs.get("feedback_by_standard_id") or []
                if isinstance(fb_raw, str):
                    fb_raw = json.loads(fb_raw)

                achieved = None
                if achieved_raw:
                    achieved = [
                        StandardAchievement(
                            standard_id=a.get("standard_id") if isinstance(a, dict) else None,
                            achieved=a.get("achieved") if isinstance(a, dict) else None,
                        )
                        for a in achieved_raw
                        if isinstance(a, dict)
                    ]
                passed = None
                if passed_raw:
                    passed = [
                        StandardPass(
                            standard_id=p.get("standard_id") if isinstance(p, dict) else None,
                            passed=p.get("passed") if isinstance(p, dict) else None,
                        )
                        for p in passed_raw
                        if isinstance(p, dict)
                    ]
                fb_by_std = None
                if fb_raw:
                    fb_by_std = [
                        StandardFeedback(
                            standard_id=f.get("standard_id") if isinstance(f, dict) else None,
                            feedback=f.get("feedback") if isinstance(f, dict) else None,
                        )
                        for f in fb_raw
                        if isinstance(f, dict)
                    ]
                grading_state_data = GradingStateData(
                    achieved_standards=achieved,
                    passed_standards=passed,
                    grade_description=gs.get("grade_description"),
                    feedback_by_standard_id=fb_by_std,
                )

            # Build hints by message
            hints_by_msg: list[HintsByMessage] | None = None
            if chat_ext.get("hints"):
                hints_by_msg = []
                for h in chat_ext["hints"]:
                    hints_raw = h.get("hints") or []
                    if isinstance(hints_raw, str):
                        hints_raw = json.loads(hints_raw)
                    hints_by_msg.append(
                        HintsByMessage(
                            message_id=h.get("message_id"),
                            hints=[
                                HintEntry(
                                    hint=hi.get("hint") if isinstance(hi, dict) else None,
                                    idx=hi.get("idx") if isinstance(hi, dict) else None,
                                )
                                for hi in hints_raw
                                if isinstance(hi, dict)
                            ],
                        )
                    )

            # === BUILD ENRICHED RESOURCE ENTRIES ===
            # Normal/General View resources
            problem_statement_entry: ProblemStatementEntry | None = None
            if chat_item.problem_statement_id:
                ps_meta = resource_meta["problem_statements"].get(chat_item.problem_statement_id, {})
                problem_statement_entry = ProblemStatementEntry(
                    problem_statement_id=chat_item.problem_statement_id,
                    problem_statement=ps_meta.get("problem_statement"),
                )

            objectives_entries: list[ObjectiveEntry] | None = None
            if chat_item.objective_ids:
                objectives_entries = [
                    ObjectiveEntry(
                        objective_id=obj_id,
                        objective=resource_meta["objectives"].get(obj_id, {}).get("objective"),
                    )
                    for obj_id in chat_item.objective_ids
                ]

            personas_entries: list[PersonaEntry] | None = None
            if chat_item.persona_ids:
                personas_entries = [
                    PersonaEntry(
                        id=p_id,
                        name=resource_meta["personas"].get(p_id, {}).get("name"),
                        icon=resource_meta["personas"].get(p_id, {}).get("icon"),
                        color=resource_meta["personas"].get(p_id, {}).get("color"),
                    )
                    for p_id in chat_item.persona_ids
                ]

            enriched_images: list[ImageEntry] | None = None
            if chat_item.image_ids:
                enriched_images = [
                    ImageEntry(
                        image_id=img_id,
                        upload_id=resource_meta["images"].get(img_id, {}).get("upload_id"),
                        name=resource_meta["images"].get(img_id, {}).get("name"),
                        description=resource_meta["images"].get(img_id, {}).get("description"),
                    )
                    for img_id in chat_item.image_ids
                ]

            # Video/Quiz View resources
            enriched_videos: list[VideoEntry] | None = None
            if chat_item.video_ids:
                enriched_videos = [
                    VideoEntry(
                        video_id=vid_id,
                        upload_id=resource_meta["videos"].get(vid_id, {}).get("upload_id"),
                        name=resource_meta["videos"].get(vid_id, {}).get("name"),
                        description=resource_meta["videos"].get(vid_id, {}).get("description"),
                    )
                    for vid_id in chat_item.video_ids
                ]

            questions_entries: list[QuestionEntry] | None = None
            if chat_item.question_ids:
                questions_entries = [
                    QuestionEntry(
                        question_id=q_id,
                        question_text=resource_meta["questions"].get(q_id, {}).get("question_text"),
                        allow_multiple=resource_meta["questions"].get(q_id, {}).get("allow_multiple"),
                    )
                    for q_id in chat_item.question_ids
                ]

            options_entries: list[OptionEntry] | None = None
            if chat_item.option_ids:
                options_entries = [
                    OptionEntry(
                        option_id=o_id,
                        option_text=resource_meta["options"].get(o_id, {}).get("option_text"),
                        is_correct=resource_meta["options"].get(o_id, {}).get("is_correct"),
                    )
                    for o_id in chat_item.option_ids
                ]

            responses_entries: list[QuizResponse] | None = None
            if chat_item.responses:
                responses_entries = [
                    QuizResponse(
                        question_id=r.question_id,
                        option_id=r.option_id,
                        completed=r.completed,
                        created_at=r.created_at,
                    )
                    for r in chat_item.responses
                ]

            # Both Views resources
            enriched_documents: list[DocumentEntry] | None = None
            if chat_item.document_ids:
                enriched_documents = [
                    DocumentEntry(
                        document_id=doc_id,
                        upload_id=resource_meta["documents"].get(doc_id, {}).get("upload_id"),
                        name=resource_meta["documents"].get(doc_id, {}).get("name"),
                        description=resource_meta["documents"].get(doc_id, {}).get("description"),
                    )
                    for doc_id in chat_item.document_ids
                ]

            templates_entries: list[TemplateEntry] | None = None
            if chat_item.template_ids:
                templates_entries = [
                    TemplateEntry(
                        template_id=t_id,
                        name=resource_meta["templates"].get(t_id, {}).get("name"),
                        description=resource_meta["templates"].get(t_id, {}).get("description"),
                    )
                    for t_id in chat_item.template_ids
                ]

            # Scenario resource (enriched from internal handler)
            scenario_entry: ScenarioEntry | None = None
            if chat_item.scenario_id:
                scenario_meta = resource_meta["scenarios"].get(chat_item.scenario_id, {})
                scenario_entry = ScenarioEntry(
                    scenario_id=chat_item.scenario_id,
                    name=scenario_meta.get("name"),
                    description=scenario_meta.get("description"),
                )

            # Rubric/Grade resources (enriched from internal handlers)
            rubric_entry: RubricEntry | None = None
            if chat_item.rubric_id:
                rubric_meta = resource_meta["rubrics"].get(chat_item.rubric_id, {})
                rubric_entry = RubricEntry(
                    rubric_id=chat_item.rubric_id,
                    name=rubric_meta.get("name"),
                    description=rubric_meta.get("description"),
                    total_points=rubric_meta.get("total_points"),
                    pass_points=rubric_meta.get("pass_points"),
                )

            standard_groups_entries: list[StandardGroupEntry] | None = None
            if chat_item.standard_group_ids:
                standard_groups_entries = [
                    StandardGroupEntry(
                        standard_group_id=sg_id,
                        name=resource_meta["standard_groups"].get(sg_id, {}).get("name"),
                        description=resource_meta["standard_groups"].get(sg_id, {}).get("description"),
                        points=resource_meta["standard_groups"].get(sg_id, {}).get("points"),
                        pass_points=resource_meta["standard_groups"].get(sg_id, {}).get("pass_points"),
                    )
                    for sg_id in chat_item.standard_group_ids
                ]

            standards_entries: list[StandardEntry] | None = None
            if chat_item.standard_ids:
                standards_entries = [
                    StandardEntry(
                        standard_id=s_id,
                        standard_group_id=resource_meta["standards"].get(s_id, {}).get("standard_group_id"),
                        name=resource_meta["standards"].get(s_id, {}).get("name"),
                        description=resource_meta["standards"].get(s_id, {}).get("description"),
                        points=resource_meta["standards"].get(s_id, {}).get("points"),
                    )
                    for s_id in chat_item.standard_ids
                ]

            chats.append(
                ChatData(
                    id=chat_item.chat_id,
                    completed=chat_item.completed,
                    is_current=chat_item.is_current,
                    position=chat_item.position,
                    grade=grade,
                    feedbacks=feedbacks,
                    messages=messages,
                    # Chat-level flags
                    show_problem_statement=chat_item.show_problem_statement,
                    show_objectives=chat_item.show_objectives,
                    copy_paste_allowed=chat_item.copy_paste_allowed,
                    text_enabled=chat_item.text_enabled,
                    audio_enabled=chat_item.audio_enabled,
                    # Extended fields
                    grading_state=grading_state_data,
                    hints=hints_by_msg,
                    # Scenario resource (enriched from internal handler)
                    scenario=scenario_entry,
                    # Normal/General View resources
                    problem_statement=problem_statement_entry,
                    objectives=objectives_entries,
                    personas=personas_entries,
                    images=enriched_images,
                    # Video/Quiz View resources
                    videos=enriched_videos,
                    questions=questions_entries,
                    options=options_entries,
                    responses=responses_entries,
                    # Both Views resources
                    documents=enriched_documents,
                    templates=templates_entries,
                    # Rubric/Grade resources (enriched from internal handlers)
                    rubric=rubric_entry,
                    standard_groups=standard_groups_entries,
                    standards=standards_entries,
                )
            )

        # === BUILD ATTEMPT DATA ===
        attempt = AttemptData(
            id=attempt_item.attempt_id,
            created_at=(
                attempt_item.created_at.isoformat()
                if attempt_item.created_at
                else None
            ),
            infinite_mode=attempt_item.infinite_mode,
            profile_id=attempt_item.profile_id,
            profile_name=profile_name,
            department_id=attempt_item.department_id,
            # Home mode only
            cohort_id=attempt_item.cohort_id if not practice else None,
            # Practice mode only
            is_archived=False if practice else None,  # Practice attempts from view are not archived
        )

        # === BUILD SIMULATION DATA ===
        simulation = SimulationData(
            id=attempt_item.simulation_id,
            name=simulation_name,
            description=None,  # Not in view
            time_limit=sim_config.get("time_limit") if sim_config else None,
            hints_enabled=sim_config.get("hints_enabled") if sim_config else None,
            objectives_enabled=sim_config.get("objectives_enabled") if sim_config else None,
            image_input_active=sim_config.get("image_input_active") if sim_config else None,
            copy_paste_allowed=sim_config.get("copy_paste_allowed") if sim_config else None,
            # Extended config fields
            practice_simulation=sim_config.get("practice_simulation") if sim_config else None,
            input_guardrail_active=sim_config.get("input_guardrail_active") if sim_config else None,
            output_guardrail_active=sim_config.get("output_guardrail_active") if sim_config else None,
            rubric_id=sim_config.get("rubric_id") if sim_config else None,
        )

        # === BUILD TIMER DATA ===
        time_limit_seconds = sim_config.get("time_limit") if sim_config else None
        timer = _format_timer(
            elapsed=attempt_item.elapsed_seconds or 0,
            limit_seconds=time_limit_seconds,
            infinite_mode=attempt_item.infinite_mode or False,
        )

        # === BUILD AGGREGATED RESULTS ===
        total_score = attempt_item.total_score or 0
        total_chats = attempt_item.total_chats or 0
        completed_chats = attempt_item.completed_chats or 0

        # Calculate total_possible from completed chats' rubric total_points
        total_possible = 0.0
        for chat in chats:
            if chat.completed and chat.rubric and chat.rubric.total_points:
                total_possible += chat.rubric.total_points

        percentage = (
            round((total_score / total_possible) * 100, 2)
            if total_possible > 0
            else 0.0
        )

        aggregated_results = AggregatedResults(
            total_score=total_score,
            total_possible_points=float(total_possible),
            percentage=percentage,
            passed=attempt_item.all_passed,
            chats_completed=completed_chats,
            total_chats=total_chats,
        )

        # === COMPUTE NAVIGATION/UI FIELDS ===
        # current_chat_index: index of the first incomplete chat, or last chat if all complete
        current_chat_index = 0
        for i, chat in enumerate(chats):
            if not chat.completed:
                current_chat_index = i
                break
            current_chat_index = i  # Will be last index if all complete

        # expected_chat_count: total number of chats
        expected_chat_count = len(chats)

        # is_active: True if timer has not exceeded
        is_active = not timer.exceeded if timer else True

        # === BUILD SCENARIO DOCUMENTS ===
        scenario_documents: list[ScenarioDocumentEntry] | None = None
        if scenario_docs_raw:
            scenario_documents = [
                ScenarioDocumentEntry(
                    document_id=doc.get("document_id"),
                    name=doc.get("name"),
                    type=doc.get("type"),
                    updated_at=doc.get("updated_at"),
                    extension=doc.get("extension"),
                    file_path=doc.get("file_path"),
                    mime_type=doc.get("mime_type"),
                    upload_id=doc.get("upload_id"),
                )
                for doc in scenario_docs_raw
            ]

        # === BUILD RUBRIC STRUCTURE ===
        rubric_structure: RubricStructureData | None = None
        if rubric_struct_raw:
            rubric_structure = RubricStructureData(
                standard_groups=[
                    StandardGroupStandards(
                        standard_group_id=sg.get("standard_group_id"),
                        standard_ids=sg.get("standard_ids"),
                    )
                    for sg in rubric_struct_raw.get("standard_groups", [])
                ],
                standard_groups_mapping=[
                    StandardGroupMapping(
                        standard_group_id=sg.get("standard_group_id"),
                        name=sg.get("name"),
                        description=sg.get("description"),
                        points=sg.get("points"),
                        pass_points=sg.get("pass_points"),
                    )
                    for sg in rubric_struct_raw.get("standard_groups_mapping", [])
                ],
                standards_mapping=[
                    StandardMapping(
                        standard_id=sm.get("standard_id"),
                        name=sm.get("name"),
                        description=sm.get("description"),
                        points=sm.get("points"),
                    )
                    for sm in rubric_struct_raw.get("standards_mapping", [])
                ],
            )

        # === COMPUTE UI CONTROL FLAGS ===
        # show_results: True if all chats are completed
        all_chats_completed = all(chat.completed for chat in chats) if chats else False
        show_results = all_chats_completed

        # should_show_controls: True if attempt is active and user can proceed
        # (i.e., timer not exceeded and not all chats completed)
        should_show_controls = is_active and not all_chats_completed

        # === BUILD RESPONSE ===
        api_response = GetAttemptDetailResponse(
            actor_name=profile_name,
            attempt_exists=True,
            access_denied=False,
            attempt=attempt,
            simulation=simulation,
            chats=chats,
            timer=timer,
            aggregated_results=aggregated_results,
            # Navigation/UI fields
            current_chat_index=current_chat_index,
            expected_chat_count=expected_chat_count,
            is_active=is_active,
            show_results=show_results,
            should_show_controls=should_show_controls,
            # Continuation options not yet implemented - will be added when needed
            available_continuation_options=None,
            # Extended data
            scenario_documents=scenario_documents,
            rubric_structure=rubric_structure,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="attempt_get",
            sql_query="view_internals: attempts, chats, messages",
            sql_params=None,
            request=http_request,
        )
