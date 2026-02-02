"""Attempt detail endpoint - POST /attempt/get.

Unified endpoint for attempt detail. The practice flag is determined from
the attempt data itself (not from client request). Uses view internal handlers
with parallel query execution:
1. Query 1 (Attempt): Attempt-level data via simulation_attempts view
2. Query 2 (Chats): Chat-level data via simulation_chats view
3. Query 3 (Messages): Message-level data via simulation_messages view

All three queries run in parallel using pool.acquire() for each,
then results are assembled in Python.
"""

import asyncio
from collections import defaultdict
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.attempt.permissions import (
    check_attempt_access,
    compute_achieved_standards,
    compute_attempt_aggregates,
    compute_chat_position_and_current,
    compute_current_chat_index,
    compute_passed_standards,
    compute_percentage,
    compute_total_possible_points,
)
from app.api.v4.artifacts.attempt.types import (
    AggregatedResults,
    AnalysisEntry,
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
    MessageData,
    MessageFeedbackEntry,
    ObjectiveEntry,
    OptionEntry,
    PersonaEntry,
    ProblemStatementEntry,
    QuestionEntry,
    QuizResponse,
    ReplacementEntry,
    RubricEntry,
    RubricStructureData,
    ScenarioEntry,
    SimulationData,
    StandardEntry,
    StandardGroupEntry,
    StandardGroupMeta,
    StandardMeta,
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

    Uses view internal handlers with pool-based parallel fetch:
    - View 1: simulation_attempts (attempt-level aggregates)
    - View 2: simulation_chats (chat-level data with grades/feedbacks)
    - View 3: simulation_messages (message-level data with strengths/improvements/hints)

    Each query runs on its own connection from the pool for true parallelism.
    The practice flag is determined from the attempt data itself.
    """
    tags = ["attempt"]

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

        async def fetch_attempt(aid: UUID) -> Any:
            async with pool.acquire() as c:
                return await get_simulation_attempts_internal(
                    conn=c,
                    attempt_ids=[aid],
                    bypass_cache=bypass_cache,
                )

        async def fetch_chats(aid: UUID) -> Any:
            async with pool.acquire() as c:
                return await get_simulation_chats_internal(
                    conn=c,
                    attempt_id=aid,
                    bypass_cache=bypass_cache,
                )

        async def fetch_messages(aid: UUID) -> Any:
            async with pool.acquire() as c:
                # Hints are always included from MV
                return await get_simulation_messages_internal(
                    conn=c,
                    attempt_id=aid,
                    bypass_cache=bypass_cache,
                )

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
                                "time": item.time,  # Video timestamp when to show
                            }

                # Fetch options
                if option_ids:
                    items = await get_options_internal(c, option_ids, bypass_cache=bypass_cache)
                    for item in items:
                        if item.option_id:
                            result["options"][item.option_id] = {
                                "option_text": item.option_text,
                                "is_correct": item.is_correct,
                                "question_id": item.question_id,  # Link to parent question
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

        # === EXECUTE ALL QUERIES IN PARALLEL ===
        # First batch: attempt, chats, messages (needed to get simulation_id and chat_ids)
        attempt_result, chats_result, messages_result = await asyncio.gather(
            fetch_attempt(attempt_id),
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

        # Determine practice mode from attempt data (not from client request)
        practice = attempt_item.practice or False

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

        # === COMPUTE TIME LIMIT FROM CHATS ===
        # Sum time_limit_seconds from all chats (denormalized from scenario_time_limits)
        simulation_id = attempt_item.simulation_id
        chat_ids = [c.chat_id for c in (chats_result or [])]
        time_limit_seconds = sum(
            c.time_limit_seconds or 0 for c in (chats_result or [])
        )

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
            # Note: Messages MV now has simplified types - no id/message_id on nested types,
            # contents only have persona_id (metadata fetched via internal handlers)
            messages: list[MessageData] = []
            is_own_attempt = attempt_item.profile_id == profiles_id

            for msg in chat_messages:
                # Transform to unified feedbacks (strengths + improvements with type)
                feedbacks: list[MessageFeedbackEntry] = []

                # Add strengths as type="strength"
                if msg.strengths:
                    for idx, s in enumerate(msg.strengths):
                        highlights: list[HighlightEntry] = []
                        if s.highlights:
                            for h in s.highlights:
                                highlights.append(
                                    HighlightEntry(section=h.section, idx=h.idx)
                                )
                        # Generate unique ID: message_id + type + index
                        feedback_id = f"{msg.message_id}-strength-{idx}"
                        feedbacks.append(
                            MessageFeedbackEntry(
                                id=feedback_id,
                                name=s.name,
                                description=s.description,
                                type="strength",
                                highlights=highlights,
                                replaces=None,
                            )
                        )

                # Add improvements as type="improvement"
                if msg.improvements:
                    for idx, i in enumerate(msg.improvements):
                        replaces: list[ReplacementEntry] = []
                        if i.replacements:
                            for r in i.replacements:
                                replaces.append(
                                    ReplacementEntry(
                                        section=r.section,
                                        replace=r.replace_text,
                                        idx=r.idx,
                                    )
                                )
                        # Generate unique ID: message_id + type + index
                        feedback_id = f"{msg.message_id}-improvement-{idx}"
                        feedbacks.append(
                            MessageFeedbackEntry(
                                id=feedback_id,
                                name=i.name,
                                description=i.description,
                                type="improvement",
                                highlights=None,
                                replaces=replaces,
                            )
                        )

                # Transform hints (always included, no message_id in view types)
                hints: list[HintEntry] | None = None
                if msg.hints:
                    hints = [
                        HintEntry(hint=h.hint, idx=h.idx)
                        for h in msg.hints
                    ]

                # Transform contents - look up persona metadata from resource_meta
                # Contents only have content, persona_id, created_at from MV
                contents: list[ContentEntry] | None = None
                if msg.contents:
                    contents = []
                    for c in msg.contents:
                        # Look up persona metadata from resource_meta
                        persona_meta = resource_meta["personas"].get(c.persona_id, {}) if c.persona_id else {}
                        persona_name = persona_meta.get("name")
                        persona_color = persona_meta.get("color")
                        persona_icon = persona_meta.get("icon")

                        # Compute display fields
                        # For user messages (type='query'): use profile_name
                        # For assistant messages (type='response'): use persona metadata
                        if msg.type == "query":
                            # User message - use profile name
                            name = "You" if is_own_attempt else profile_name
                            color = None
                            icon = "User"
                        else:
                            # Assistant message - use persona metadata
                            name = persona_name
                            color = persona_color
                            icon = persona_icon

                        contents.append(
                            ContentEntry(
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
                        type=msg.type,
                        created_at=(
                            msg.created_at.isoformat() if msg.created_at else None
                        ),
                        completed=msg.completed,
                        contents=contents,
                        feedbacks=feedbacks if feedbacks else None,
                        hints=hints,
                    )
                )

            # Build grade data
            grade = None
            # Build grade from chat grade composite
            # total_points/pass_points come from rubric metadata (not stored in grade entry)
            if chat_item.grade:
                # Get rubric points from resource metadata
                rubric_meta = resource_meta["rubrics"].get(chat_item.rubric_id, {}) if chat_item.rubric_id else {}
                grade = GradeData(
                    score=chat_item.grade.score,
                    passed=chat_item.grade.passed,
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

            # Transform analyses (chat-level analysis content)
            analyses_entries: list[AnalysisEntry] | None = None
            if chat_item.analyses:
                analyses_entries = [
                    AnalysisEntry(content=a.content)
                    for a in chat_item.analyses
                ]

            # Build grading state - derive achieved/passed from feedbacks + resource_meta
            # Build grading state in Record format (what client needs)
            grading_state_data: GradingStateData | None = None
            if chat_item.grade or chat_item.feedbacks:
                # Build Records for achieved/passed/feedback
                achieved_dict: dict[str, bool] = {}
                passed_dict: dict[str, bool] = {}
                feedback_dict: dict[str, str] = {}

                if chat_item.feedbacks:
                    # Build feedbacks as dicts for the compute functions
                    feedbacks_dicts = [
                        {"standard_id": fb.standard_id, "total": fb.total}
                        for fb in chat_item.feedbacks
                    ]

                    # Compute achieved standards (any standard with feedback is achieved)
                    achieved_raw = compute_achieved_standards(feedbacks_dicts)
                    if achieved_raw:
                        for a in achieved_raw:
                            std_id = a.get("standard_id")
                            if std_id:
                                achieved_dict[str(std_id)] = a.get("achieved", False)

                    # Compute passed standards (total >= standard_group pass_points)
                    passed_raw = compute_passed_standards(
                        feedbacks_dicts,
                        resource_meta["standard_groups"],
                        resource_meta["standards"],
                    )
                    if passed_raw:
                        for p in passed_raw:
                            std_id = p.get("standard_id")
                            if std_id:
                                passed_dict[str(std_id)] = p.get("passed", False)

                    # feedback_by_standard_id from chats MV feedbacks
                    for fb in chat_item.feedbacks:
                        if fb.standard_id and fb.feedback:
                            feedback_dict[str(fb.standard_id)] = fb.feedback

                grading_state_data = GradingStateData(
                    achieved_standards=achieved_dict if achieved_dict else None,
                    passed_standards=passed_dict if passed_dict else None,
                    feedback_by_standard_id=feedback_dict if feedback_dict else None,
                )

            # Build hints by message from messages MV (already in msg.hints)
            # Group hints by message_id for the hints_by_msg structure
            hints_by_msg: list[HintsByMessage] | None = None
            msg_hints: dict[UUID, list[HintEntry]] = {}
            for msg in chat_messages:
                if msg.hints:
                    msg_hints[msg.message_id] = [
                        HintEntry(hint=h.hint, idx=h.idx)
                        for h in msg.hints
                    ]
                if msg_hints:
                    hints_by_msg = [
                        HintsByMessage(message_id=mid, hints=hints_list)
                        for mid, hints_list in msg_hints.items()
                    ]

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

            # Build questions with nested options
            # Group options by question_id first
            options_by_question: dict[UUID, list[OptionEntry]] = defaultdict(list)
            if chat_item.option_ids:
                for o_id in chat_item.option_ids:
                    opt_meta = resource_meta["options"].get(o_id, {})
                    q_id = opt_meta.get("question_id")
                    if q_id:
                        options_by_question[q_id].append(
                            OptionEntry(
                                option_id=o_id,
                                option_text=opt_meta.get("option_text"),
                                is_correct=opt_meta.get("is_correct"),
                            )
                        )

            questions_entries: list[QuestionEntry] | None = None
            if chat_item.question_ids:
                questions_entries = []
                for q_id in chat_item.question_ids:
                    q_meta = resource_meta["questions"].get(q_id, {})
                    time_val = q_meta.get("time")
                    # Convert single time to list for client (times array)
                    times = [time_val] if time_val is not None else None
                    questions_entries.append(
                        QuestionEntry(
                            question_id=q_id,
                            question_text=q_meta.get("question_text"),
                            allow_multiple=q_meta.get("allow_multiple"),
                            times=times,
                            options=options_by_question.get(q_id) or None,
                        )
                    )

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
                    # is_current and position are computed after all chats are built
                    grade=grade,
                    feedbacks=feedbacks,
                    analyses=analyses_entries,
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
                    questions=questions_entries,  # Options nested inside questions
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
        # Use chat-level flags from first chat (all chats in an attempt share same simulation config)
        first_chat = chats_result[0] if chats_result else None
        simulation = SimulationData(
            id=attempt_item.simulation_id,
            name=simulation_name,
            description=None,  # Not in view
            time_limit=time_limit_seconds if time_limit_seconds > 0 else None,
            # Flags from chat-level (equivalent to simulation flags)
            hints_enabled=first_chat.hints_enabled if first_chat else None,
            objectives_enabled=first_chat.show_objectives if first_chat else None,
            image_input_active=first_chat.show_images if first_chat else None,
            copy_paste_allowed=first_chat.copy_paste_allowed if first_chat else None,
            # Practice flag from attempt
            practice_simulation=practice,
            # rubric_id from first chat
            rubric_id=first_chat.rubric_id if first_chat else None,
        )

        # === COMPUTE DERIVED FIELDS (centralized in permissions.py) ===
        # Compute position and is_current for each chat
        compute_chat_position_and_current(chats)

        # Compute attempt aggregates from chats
        aggregates = compute_attempt_aggregates(chats)
        total_chats = aggregates["total_chats"]
        completed_chats = aggregates["completed_chats"]
        total_score = aggregates["total_score"]
        all_passed = aggregates["all_passed"]
        elapsed_seconds = aggregates["elapsed_seconds"]

        # === BUILD TIMER DATA ===
        timer = _format_timer(
            elapsed=elapsed_seconds,
            limit_seconds=time_limit_seconds if time_limit_seconds > 0 else None,
            infinite_mode=attempt_item.infinite_mode or False,
        )

        # === BUILD AGGREGATED RESULTS ===
        total_possible = compute_total_possible_points(chats)
        percentage = compute_percentage(total_score, total_possible)

        aggregated_results = AggregatedResults(
            total_score=total_score,
            total_possible_points=float(total_possible),
            percentage=percentage,
            passed=all_passed,
            chats_completed=completed_chats,
            total_chats=total_chats,
        )

        # === COMPUTE NAVIGATION/UI FIELDS ===
        current_chat_index = compute_current_chat_index(chats)
        expected_chat_count = total_chats

        # is_active: True if timer has not exceeded
        is_active = not timer.exceeded if timer else True

        # === BUILD RUBRIC STRUCTURE in Record format (what client needs) ===
        rubric_structure: RubricStructureData | None = None
        if all_standard_group_ids or all_standard_ids:
            # Build standard_groups dict: group_id -> list of standard_ids
            standard_groups_dict: dict[str, list[str]] = {}
            for std_id in set(all_standard_ids):
                std_meta = resource_meta["standards"].get(std_id, {})
                sg_id = std_meta.get("standard_group_id")
                if sg_id:
                    sg_id_str = str(sg_id)
                    if sg_id_str not in standard_groups_dict:
                        standard_groups_dict[sg_id_str] = []
                    standard_groups_dict[sg_id_str].append(str(std_id))

            # Build standard_groups_mapping dict: group_id -> metadata
            standard_groups_mapping_dict: dict[str, StandardGroupMeta] = {}
            for sg_id in set(all_standard_group_ids):
                sg_meta = resource_meta["standard_groups"].get(sg_id, {})
                standard_groups_mapping_dict[str(sg_id)] = StandardGroupMeta(
                    name=sg_meta.get("name"),
                    description=sg_meta.get("description"),
                    points=sg_meta.get("points"),
                    pass_points=sg_meta.get("pass_points"),
                )

            # Build standards_mapping dict: standard_id -> metadata
            standards_mapping_dict: dict[str, StandardMeta] = {}
            for std_id in set(all_standard_ids):
                std_meta = resource_meta["standards"].get(std_id, {})
                standards_mapping_dict[str(std_id)] = StandardMeta(
                    name=std_meta.get("name"),
                    description=std_meta.get("description"),
                    points=std_meta.get("points"),
                )

            rubric_structure = RubricStructureData(
                standard_groups=standard_groups_dict if standard_groups_dict else None,
                standard_groups_mapping=standard_groups_mapping_dict if standard_groups_mapping_dict else None,
                standards_mapping=standards_mapping_dict if standards_mapping_dict else None,
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
            # Extended data (scenario_documents removed - use chat.documents)
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
