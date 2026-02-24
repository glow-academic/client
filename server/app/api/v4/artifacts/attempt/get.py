"""Attempt detail endpoint - POST /attempt/get.

Three-layer BFF pattern:
- get_attempt_internal(): Core data fetcher, returns AttemptInternalData
- get_attempt_client(): HTTP response layer with caching
- get_attempt_websocket(): WebSocket response layer with config resources

Uses view internal handlers with parallel query execution:
1. Query 1 (Attempt): Attempt-level data via attempt view
2. Query 2 (Chats): Chat-level data via attempt_chat view
3. Query 3 (Messages): Message-level data via attempt_message view

All three queries run in parallel using pool.acquire() for each,
then results are assembled in Python.
"""

import asyncio
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.attempt.permissions import (
    check_attempt_access,
    compute_achieved_standards,
    compute_attempt_aggregates,
    compute_chat_position_and_current,
    compute_continuation_options,
    compute_current_chat_index,
    compute_passed_standards,
    compute_percentage,
    compute_total_possible_points,
)
from app.api.v4.artifacts.attempt.types import (
    AggregatedResults,
    AnalysisEntry,
    AttemptData,
    AttemptEntries,
    AttemptInternalData,
    AttemptResources,
    AttemptWebsocketResources,
    ChatData,
    ContentEntry,
    DocumentEntry,
    FeedbackEntry,
    GetAttemptDetailRequest,
    GetAttemptDetailResponse,
    GetAttemptWebsocketResponse,
    GradeData,
    GradingStateData,
    HighlightEntry,
    HintEntry,
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
    TimerData,
    VideoEntry,
)
from app.api.v4.artifacts.types import WebsocketArtifacts
from app.api.v4.entries.attempt.get import (
    get_attempt_chats_internal,
    get_attempt_messages_internal,
)
from app.api.v4.entries.attempt.search import get_attempt_list_internal
from app.api.v4.entries.attempt_analysis.get import get_attempt_analysis_internal
from app.api.v4.entries.attempt_content.get import get_attempt_content_internal
from app.api.v4.entries.attempt_feedback.get import get_attempt_feedback_internal
from app.api.v4.entries.attempt_grade.get import get_attempt_grade_internal
from app.api.v4.entries.attempt_highlight.get import (
    get_attempt_highlight_internal,
)
from app.api.v4.entries.attempt_hint.get import get_attempt_hint_internal
from app.api.v4.entries.attempt_improvement.get import (
    get_attempt_improvement_internal,
)
from app.api.v4.entries.attempt_replacement.get import (
    get_attempt_replacement_internal,
)
from app.api.v4.entries.attempt_strength.get import (
    get_attempt_strength_internal,
)
from app.api.v4.entries.responses.get import (
    get_simulation_responses_internal,
)
from app.api.v4.entries.uploads.get import get_upload_list_view_internal
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.args.get import get_args_internal
from app.api.v4.resources.args_outputs.get import get_args_outputs_internal
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.images.get import get_images_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.objectives.get import get_objectives_internal
from app.api.v4.resources.options.get import get_options_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.problem_statements.get import (
    get_problem_statements_internal,
)
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.questions.get import get_questions_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.api.v4.resources.standard_groups.get import get_standard_groups_internal
from app.api.v4.resources.standards.get import get_standards_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.resources.videos.get import get_videos_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


def _format_timer(
    elapsed: int, limit_seconds: int | None, infinite_mode: bool, negative: bool = False
) -> TimerData:
    """Format timer data.

    Args:
        elapsed: Elapsed time in seconds
        limit_seconds: Time limit in seconds (not minutes)
        infinite_mode: Whether the attempt is in infinite mode
        negative: Whether the timer can go negative (continue past zero)
    """
    if limit_seconds is None or limit_seconds == 0:
        return TimerData(
            elapsed=elapsed,
            limit=None,
            exceeded=False,
            formatted="",
            negative=negative,
        )

    remaining = limit_seconds - elapsed
    # If negative is allowed, don't clamp remaining to 0
    if not negative:
        remaining = max(remaining, 0)
    exceeded = remaining <= 0 if infinite_mode else elapsed > limit_seconds

    # Format time (handle negative values)
    abs_remaining = abs(remaining)
    hours = abs_remaining // 3600
    minutes = (abs_remaining % 3600) // 60
    seconds = abs_remaining % 60
    sign = "-" if remaining < 0 else ""
    formatted = f"{sign}{hours}h {minutes}m {seconds}s"

    return TimerData(
        elapsed=elapsed,
        limit=limit_seconds,
        exceeded=exceeded,
        formatted=formatted,
        negative=negative,
    )


# =============================================================================
# Layer 1: Core data fetcher (no caching, no HTTP concerns)
# =============================================================================


async def get_attempt_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    attempt_id: UUID,
    bypass_cache: bool = False,
    http_request: Request | None = None,
) -> AttemptInternalData:
    """Core attempt detail fetcher.

    Fetches all data, computes business logic, and returns AttemptInternalData.
    No caching — consumer layers handle their own caching.
    """
    try:
        # Resolve profile_id (artifact) to profiles_id (resource) + role
        requester_row = await conn.fetchrow(
            """
            SELECT ppj.profiles_id, pr.role
            FROM profile_profiles_junction ppj
            JOIN profiles_resource pr ON pr.id = ppj.profiles_id
            WHERE ppj.profile_id = $1 AND ppj.active = true
            LIMIT 1
            """,
            profile_id,
        )
        profiles_id = requester_row["profiles_id"] if requester_row else None
        requester_role: str | None = requester_row["role"] if requester_row else None

        # Get pool for parallel queries
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # === PARALLEL FETCH FUNCTIONS ===
        # Each function acquires its own connection for true parallelism

        async def fetch_attempt(aid: UUID) -> Any:
            async with pool.acquire() as c:
                return await get_attempt_list_internal(
                    conn=c,
                    attempt_ids=[aid],
                    bypass_cache=bypass_cache,
                )

        async def fetch_chats(aid: UUID) -> Any:
            async with pool.acquire() as c:
                return await get_attempt_chats_internal(
                    conn=c,
                    attempt_id=aid,
                    bypass_cache=bypass_cache,
                )

        async def fetch_messages(aid: UUID) -> Any:
            async with pool.acquire() as c:
                # Hints are always included from MV
                return await get_attempt_messages_internal(
                    conn=c,
                    attempt_id=aid,
                    bypass_cache=bypass_cache,
                )

        async def fetch_resource_metadata(
            image_ids: list[UUID],
            video_ids: list[UUID],
            document_ids: list[UUID],
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
            """Fetch resource metadata using internal handlers (with caching)."""
            result: dict[str, dict[UUID, dict]] = {
                "images": {},
                "videos": {},
                "documents": {},
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
                    items = await get_images_internal(
                        c, image_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.image_id:
                            # Resolve upload_id from uploads_resource to uploads_entry
                            # via uploads_mv view
                            entry_upload_id = item.upload_id
                            if item.upload_id:
                                upload_view = await get_upload_list_view_internal(
                                    conn=c,
                                    uploads_id_filter=item.upload_id,
                                    bypass_cache=bypass_cache,
                                )
                                if upload_view.items:
                                    entry_upload_id = upload_view.items[0].upload_id

                            result["images"][item.image_id] = {
                                "name": item.name,
                                "description": item.description,
                                "upload_id": entry_upload_id,
                            }

                # Fetch videos
                if video_ids:
                    items = await get_videos_internal(
                        c, video_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.video_id:
                            # Resolve upload_id from uploads_resource to uploads_entry
                            # via uploads_mv view
                            entry_upload_id = item.upload_id
                            if item.upload_id:
                                upload_view = await get_upload_list_view_internal(
                                    conn=c,
                                    uploads_id_filter=item.upload_id,
                                    bypass_cache=bypass_cache,
                                )
                                if upload_view.items:
                                    entry_upload_id = upload_view.items[0].upload_id

                            result["videos"][item.video_id] = {
                                "name": item.name,
                                "description": item.description,
                                "upload_id": entry_upload_id,
                            }

                # Fetch documents
                if document_ids:
                    items = await get_documents_internal(
                        c, document_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.document_id:
                            # Resolve upload_id from uploads_resource to uploads_entry
                            # via uploads_mv view
                            entry_upload_id = item.upload_id
                            if item.upload_id:
                                upload_view = await get_upload_list_view_internal(
                                    conn=c,
                                    uploads_id_filter=item.upload_id,
                                    bypass_cache=bypass_cache,
                                )
                                if upload_view.items:
                                    entry_upload_id = upload_view.items[0].upload_id

                            result["documents"][item.document_id] = {
                                "name": item.name,
                                "description": item.description,
                                "upload_id": entry_upload_id,
                                "template": item.template,
                            }

                # Fetch personas
                if persona_ids:
                    items = await get_personas_internal(
                        c, persona_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.persona_id:
                            result["personas"][item.persona_id] = {
                                "name": item.name,
                                "icon": item.icon,
                                "color": item.color,
                                "instructions": item.instructions,
                                "examples": item.examples,
                            }

                # Fetch objectives
                if objective_ids:
                    items = await get_objectives_internal(
                        c, objective_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.objective_id:
                            result["objectives"][item.objective_id] = {
                                "objective": item.objective,
                            }

                # Fetch questions
                if question_ids:
                    items = await get_questions_internal(
                        c, question_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.question_id:
                            result["questions"][item.question_id] = {
                                "question_text": item.question_text,
                                "allow_multiple": item.allow_multiple,
                                "time": item.time,
                            }

                # Fetch options
                if option_ids:
                    items = await get_options_internal(
                        c, option_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.option_id:
                            result["options"][item.option_id] = {
                                "option_text": item.option_text,
                                "is_correct": item.is_correct,
                                "question_id": item.question_id,
                            }

                # Fetch problem statements
                if problem_statement_ids:
                    items = await get_problem_statements_internal(
                        c, problem_statement_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.problem_statement_id:
                            result["problem_statements"][item.problem_statement_id] = {
                                "problem_statement": item.problem_statement,
                            }

                # Fetch scenarios
                if scenario_ids:
                    items = await get_scenarios_internal(
                        c, scenario_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.scenario_id:
                            result["scenarios"][item.scenario_id] = {
                                "name": item.name,
                                "description": item.description,
                            }

                # Fetch rubrics
                if rubric_ids:
                    items = await get_rubrics_batch_internal(
                        c, rubric_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.rubric_id:
                            result["rubrics"][item.rubric_id] = {
                                "name": item.name,
                                "description": item.description,
                                "total_points": item.total_points,
                                "pass_points": item.pass_points,
                            }

                # Fetch standard groups
                if standard_group_ids:
                    items = await get_standard_groups_internal(
                        c, standard_group_ids, bypass_cache=bypass_cache
                    )
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
                    items = await get_standards_internal(
                        c, standard_ids, bypass_cache=bypass_cache
                    )
                    for item in items:
                        if item.standard_id:
                            result["standards"][item.standard_id] = {
                                "name": item.name,
                                "description": item.description,
                                "points": item.points,
                                "standard_group_id": item.standard_group_id,
                            }

            return result

        # === EXECUTE PASS 1: CORE VIEWS IN PARALLEL ===
        attempt_result, chats_result, messages_result = await asyncio.gather(
            fetch_attempt(attempt_id),
            fetch_chats(attempt_id),
            fetch_messages(attempt_id),
        )

        # === PASS 2: FETCH ENTRY-LEVEL DATA BY PARENT IDs ===
        message_ids = [m.message_id for m in (messages_result or [])]
        chat_ids = [c.chat_id for c in (chats_result or [])]

        if message_ids or chat_ids:

            async def fetch_contents() -> list:
                if not message_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_content_internal(
                        c, message_ids=message_ids, bypass_cache=bypass_cache
                    )

            async def fetch_strengths() -> list:
                if not message_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_strength_internal(
                        c, message_ids=message_ids, bypass_cache=bypass_cache
                    )

            async def fetch_improvements() -> list:
                if not message_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_improvement_internal(
                        c, message_ids=message_ids, bypass_cache=bypass_cache
                    )

            async def fetch_hints() -> list:
                if not message_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_hint_internal(
                        c, message_ids=message_ids, bypass_cache=bypass_cache
                    )

            async def fetch_grades() -> list:
                if not chat_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_grade_internal(
                        c, chat_ids=chat_ids, bypass_cache=bypass_cache
                    )

            async def fetch_responses() -> list:
                if not chat_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_simulation_responses_internal(
                        c, chat_ids=chat_ids, bypass_cache=bypass_cache
                    )

            (
                contents_result,
                strengths_result,
                improvements_result,
                hints_result,
                grades_result,
                responses_result,
            ) = await asyncio.gather(
                fetch_contents(),
                fetch_strengths(),
                fetch_improvements(),
                fetch_hints(),
                fetch_grades(),
                fetch_responses(),
            )
        else:
            contents_result = []
            strengths_result = []
            improvements_result = []
            hints_result = []
            grades_result = []
            responses_result = []

        # === PASS 3: FETCH GRANDCHILD DATA ===
        strength_ids = [s.strength_id for s in strengths_result]
        improvement_ids = [i.improvement_id for i in improvements_result]
        grade_ids = [g.grade_id for g in grades_result]

        if strength_ids or improvement_ids or grade_ids:

            async def fetch_highlights() -> list:
                if not strength_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_highlight_internal(
                        c, strength_ids=strength_ids, bypass_cache=bypass_cache
                    )

            async def fetch_replacements() -> list:
                if not improvement_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_replacement_internal(
                        c, improvement_ids=improvement_ids, bypass_cache=bypass_cache
                    )

            async def fetch_feedbacks() -> list:
                if not grade_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_feedback_internal(
                        c, grade_ids=grade_ids, bypass_cache=bypass_cache
                    )

            async def fetch_analyses() -> list:
                if not grade_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_attempt_analysis_internal(
                        c, grade_ids=grade_ids, bypass_cache=bypass_cache
                    )

            (
                highlights_result,
                replacements_result,
                feedbacks_result,
                analyses_result,
            ) = await asyncio.gather(
                fetch_highlights(),
                fetch_replacements(),
                fetch_feedbacks(),
                fetch_analyses(),
            )
        else:
            highlights_result = []
            replacements_result = []
            feedbacks_result = []
            analyses_result = []

        # === BUILD LOOKUP DICTS (group children by parent FK) ===
        from collections import defaultdict as _defaultdict

        contents_by_message: dict[UUID, list] = _defaultdict(list)
        for c in contents_result:
            if c.message_id:
                contents_by_message[c.message_id].append(c)

        strengths_by_message: dict[UUID, list] = _defaultdict(list)
        for s in strengths_result:
            if s.message_id:
                strengths_by_message[s.message_id].append(s)

        improvements_by_message: dict[UUID, list] = _defaultdict(list)
        for i in improvements_result:
            if i.message_id:
                improvements_by_message[i.message_id].append(i)

        hints_by_message: dict[UUID, list] = _defaultdict(list)
        for h in hints_result:
            if h.message_id:
                hints_by_message[h.message_id].append(h)

        highlights_by_strength: dict[UUID, list] = _defaultdict(list)
        for h in highlights_result:
            if h.strength_id:
                highlights_by_strength[h.strength_id].append(h)

        replacements_by_improvement: dict[UUID, list] = _defaultdict(list)
        for r in replacements_result:
            if r.improvement_id:
                replacements_by_improvement[r.improvement_id].append(r)

        grades_by_chat: dict[UUID, Any] = {}
        for g in grades_result:
            if g.chat_id:
                grades_by_chat[g.chat_id] = g

        feedbacks_by_grade: dict[UUID, list] = _defaultdict(list)
        for f in feedbacks_result:
            if f.grade_id:
                feedbacks_by_grade[f.grade_id].append(f)

        analyses_by_grade: dict[UUID, list] = _defaultdict(list)
        for a in analyses_result:
            if a.grade_id:
                analyses_by_grade[a.grade_id].append(a)

        responses_by_chat: dict[UUID, list] = _defaultdict(list)
        for r in responses_result:
            if r.chat_id:
                responses_by_chat[r.chat_id].append(r)

        if not attempt_result or not attempt_result.items:
            return AttemptInternalData(
                actor_name=None,
                attempt_exists=False,
                access_denied=True,
                is_own_attempt=False,
                practice=False,
                profiles_id=profiles_id,
                profile_name=None,
                simulation_name=None,
                training_id=None,
                chat_entry_id=None,
                group_id=None,
            )

        attempt_item = attempt_result.items[0] if attempt_result.items else None

        if not attempt_item:
            return AttemptInternalData(
                actor_name=None,
                attempt_exists=False,
                access_denied=True,
                is_own_attempt=False,
                practice=False,
                profiles_id=profiles_id,
                profile_name=None,
                simulation_name=None,
                training_id=None,
                chat_entry_id=None,
                group_id=None,
            )

        practice = attempt_item.practice or False

        # === FETCH SIMULATION AND PROFILE METADATA ===
        simulation_name: str | None = None
        profile_name: str | None = None

        async def fetch_simulation_meta(sim_id: UUID | None) -> str | None:
            if not sim_id:
                return None
            async with pool.acquire() as c:
                items = await get_simulations_internal(
                    c, [sim_id], bypass_cache=bypass_cache
                )
                if items and items[0].name:
                    return items[0].name
            return None

        async def fetch_profile_meta(prof_id: UUID | None) -> str | None:
            if not prof_id:
                return None
            async with pool.acquire() as c:
                items = await get_profiles_internal(
                    c, [prof_id], bypass_cache=bypass_cache
                )
                if items and items[0].name:
                    return items[0].name
            return None

        simulation_name, profile_name = await asyncio.gather(
            fetch_simulation_meta(attempt_item.simulation_id),
            fetch_profile_meta(attempt_item.profile_id),
        )

        # Fetch attempt owner's role for permission check
        attempt_owner_role: str | None = None
        if attempt_item.profile_id:
            attempt_owner_role = await conn.fetchval(
                "SELECT role FROM profiles_resource WHERE id = $1",
                attempt_item.profile_id,
            )

        if not check_attempt_access(
            attempt_item.profile_id,
            profiles_id,
            request_role=requester_role,
            attempt_role=attempt_owner_role,
        ):
            return AttemptInternalData(
                actor_name=profile_name,
                attempt_exists=True,
                access_denied=True,
                is_own_attempt=False,
                practice=practice,
                profiles_id=profiles_id,
                profile_name=profile_name,
                simulation_name=simulation_name,
                training_id=None,
                chat_entry_id=None,
                group_id=None,
            )

        if profile_name and http_request:
            audit_set(
                http_request,
                actor={"name": profile_name, "id": profile_id},
            )

        # === RESOLVE TRAINING CONTEXT (for lobby flow) ===
        training_id: UUID | None = None
        chat_entry_id: UUID | None = None
        training_row = await conn.fetchrow(
            """
            SELECT COALESCE(pte.chat_id, hte.chat_id) AS chat_entry_id
            FROM attempt_entry a
            LEFT JOIN attempt_practice_entry apc ON apc.attempt_id = a.id AND apc.active = true
            LEFT JOIN practice_chat_entry pte ON pte.practice_id = apc.practice_id AND pte.active = true
            LEFT JOIN attempt_home_entry ahc ON ahc.attempt_id = a.id AND ahc.active = true
            LEFT JOIN home_chat_entry hte ON hte.home_id = ahc.home_id AND hte.active = true
            WHERE a.id = $1
            """,
            attempt_id,
        )
        if training_row:
            chat_entry_id = training_row["chat_entry_id"]
            training_id = chat_entry_id

        # === RESOLVE CONFIG CHAIN (group_id -> agent/model/provider) ===
        first_chat_item = chats_result[0] if chats_result else None
        group_id = first_chat_item.group_id if first_chat_item else None

        agent_ids: dict[str, UUID | None] = {}
        config_agent_resources = None
        config_model_resources = None
        config_provider_resources = None

        if group_id:
            config_row = await conn.fetchrow(
                """
                SELECT aaj.agent_id, ar.model_id, mr.provider_id
                FROM runs_entry r
                JOIN config_entry ce ON ce.run_id = r.id
                JOIN config_agents_connection cac ON cac.config_id = ce.id AND cac.active = true
                JOIN agent_agents_junction aaj ON aaj.agents_id = cac.agents_id AND aaj.active = true
                JOIN agents_resource ar ON ar.id = aaj.agents_id
                LEFT JOIN models_resource mr ON mr.id = ar.model_id
                WHERE r.group_id = $1
                ORDER BY r.created_at DESC
                LIMIT 1
                """,
                group_id,
            )
            if config_row:
                agent_id = config_row["agent_id"]
                model_id = config_row["model_id"]
                provider_id = config_row["provider_id"]
                agent_ids["primary"] = agent_id

                # Fetch config resources in parallel
                async def fetch_config_agents() -> Any:
                    if not agent_id:
                        return None
                    async with pool.acquire() as c:
                        return await get_agents_internal(
                            c, [agent_id], bypass_cache=bypass_cache
                        )

                async def fetch_config_models() -> Any:
                    if not model_id:
                        return None
                    async with pool.acquire() as c:
                        return await get_models_internal(
                            c, [model_id], bypass_cache=bypass_cache
                        )

                async def fetch_config_providers() -> Any:
                    if not provider_id:
                        return None
                    async with pool.acquire() as c:
                        return await get_providers_internal(
                            c, [provider_id], bypass_cache=bypass_cache
                        )

                (
                    config_agent_resources,
                    config_model_resources,
                    config_provider_resources,
                ) = await asyncio.gather(
                    fetch_config_agents(),
                    fetch_config_models(),
                    fetch_config_providers(),
                )

        # === COMPUTE TIME LIMIT FROM CHATS ===
        time_limit_seconds = sum(
            c.time_limit_seconds or 0 for c in (chats_result or [])
        )
        allows_negative_time = any(
            getattr(c, "negative", False) for c in (chats_result or [])
        )

        # === COLLECT AND ENRICH RESOURCE REFS ===
        all_image_ids: list[UUID] = []
        all_video_ids: list[UUID] = []
        all_document_ids: list[UUID] = []
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

        resource_meta = await fetch_resource_metadata(
            image_ids=list(set(all_image_ids)),
            video_ids=list(set(all_video_ids)),
            document_ids=list(set(all_document_ids)),
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

        # === BUILD RESOURCE MAPS (normalized) ===
        resources_payload = AttemptResources(
            images={
                str(image_id): ImageEntry(
                    image_id=image_id,
                    upload_id=resource_meta["images"]
                    .get(image_id, {})
                    .get("upload_id"),
                    name=resource_meta["images"].get(image_id, {}).get("name"),
                    description=resource_meta["images"]
                    .get(image_id, {})
                    .get("description"),
                )
                for image_id in resource_meta["images"].keys()
            }
            if resource_meta.get("images")
            else None,
            videos={
                str(video_id): VideoEntry(
                    video_id=video_id,
                    upload_id=resource_meta["videos"]
                    .get(video_id, {})
                    .get("upload_id"),
                    name=resource_meta["videos"].get(video_id, {}).get("name"),
                    description=resource_meta["videos"]
                    .get(video_id, {})
                    .get("description"),
                )
                for video_id in resource_meta["videos"].keys()
            }
            if resource_meta.get("videos")
            else None,
            documents={
                str(document_id): DocumentEntry(
                    document_id=document_id,
                    upload_id=resource_meta["documents"]
                    .get(document_id, {})
                    .get("upload_id"),
                    name=resource_meta["documents"].get(document_id, {}).get("name"),
                    description=resource_meta["documents"]
                    .get(document_id, {})
                    .get("description"),
                    template=resource_meta["documents"]
                    .get(document_id, {})
                    .get("template"),
                )
                for document_id in resource_meta["documents"].keys()
            }
            if resource_meta.get("documents")
            else None,
            personas={
                str(persona_id): PersonaEntry(
                    id=persona_id,
                    name=resource_meta["personas"].get(persona_id, {}).get("name"),
                    icon=resource_meta["personas"].get(persona_id, {}).get("icon"),
                    color=resource_meta["personas"].get(persona_id, {}).get("color"),
                    instructions=resource_meta["personas"]
                    .get(persona_id, {})
                    .get("instructions"),
                    examples=resource_meta["personas"]
                    .get(persona_id, {})
                    .get("examples"),
                )
                for persona_id in resource_meta["personas"].keys()
            }
            if resource_meta.get("personas")
            else None,
            objectives={
                str(objective_id): ObjectiveEntry(
                    objective_id=objective_id,
                    objective=resource_meta["objectives"]
                    .get(objective_id, {})
                    .get("objective"),
                )
                for objective_id in resource_meta["objectives"].keys()
            }
            if resource_meta.get("objectives")
            else None,
            questions={
                str(question_id): QuestionEntry(
                    question_id=question_id,
                    question_text=resource_meta["questions"]
                    .get(question_id, {})
                    .get("question_text"),
                    allow_multiple=resource_meta["questions"]
                    .get(question_id, {})
                    .get("allow_multiple"),
                    times=(
                        [resource_meta["questions"].get(question_id, {}).get("time")]
                        if resource_meta["questions"].get(question_id, {}).get("time")
                        is not None
                        else None
                    ),
                )
                for question_id in resource_meta["questions"].keys()
            }
            if resource_meta.get("questions")
            else None,
            options={
                str(option_id): OptionEntry(
                    option_id=option_id,
                    question_id=resource_meta["options"]
                    .get(option_id, {})
                    .get("question_id"),
                    option_text=resource_meta["options"]
                    .get(option_id, {})
                    .get("option_text"),
                    is_correct=resource_meta["options"]
                    .get(option_id, {})
                    .get("is_correct"),
                )
                for option_id in resource_meta["options"].keys()
            }
            if resource_meta.get("options")
            else None,
            problem_statements={
                str(problem_statement_id): ProblemStatementEntry(
                    problem_statement_id=problem_statement_id,
                    problem_statement=resource_meta["problem_statements"]
                    .get(problem_statement_id, {})
                    .get("problem_statement"),
                )
                for problem_statement_id in resource_meta["problem_statements"].keys()
            }
            if resource_meta.get("problem_statements")
            else None,
            scenarios={
                str(scenario_id): ScenarioEntry(
                    scenario_id=scenario_id,
                    name=resource_meta["scenarios"].get(scenario_id, {}).get("name"),
                    description=resource_meta["scenarios"]
                    .get(scenario_id, {})
                    .get("description"),
                )
                for scenario_id in resource_meta["scenarios"].keys()
            }
            if resource_meta.get("scenarios")
            else None,
            rubrics={
                str(rubric_id): RubricEntry(
                    rubric_id=rubric_id,
                    name=resource_meta["rubrics"].get(rubric_id, {}).get("name"),
                    description=resource_meta["rubrics"]
                    .get(rubric_id, {})
                    .get("description"),
                    total_points=resource_meta["rubrics"]
                    .get(rubric_id, {})
                    .get("total_points"),
                    pass_points=resource_meta["rubrics"]
                    .get(rubric_id, {})
                    .get("pass_points"),
                )
                for rubric_id in resource_meta["rubrics"].keys()
            }
            if resource_meta.get("rubrics")
            else None,
            standard_groups={
                str(standard_group_id): StandardGroupEntry(
                    standard_group_id=standard_group_id,
                    name=resource_meta["standard_groups"]
                    .get(standard_group_id, {})
                    .get("name"),
                    description=resource_meta["standard_groups"]
                    .get(standard_group_id, {})
                    .get("description"),
                    points=resource_meta["standard_groups"]
                    .get(standard_group_id, {})
                    .get("points"),
                    pass_points=resource_meta["standard_groups"]
                    .get(standard_group_id, {})
                    .get("pass_points"),
                )
                for standard_group_id in resource_meta["standard_groups"].keys()
            }
            if resource_meta.get("standard_groups")
            else None,
            standards={
                str(standard_id): StandardEntry(
                    standard_id=standard_id,
                    standard_group_id=resource_meta["standards"]
                    .get(standard_id, {})
                    .get("standard_group_id"),
                    name=resource_meta["standards"].get(standard_id, {}).get("name"),
                    description=resource_meta["standards"]
                    .get(standard_id, {})
                    .get("description"),
                    points=resource_meta["standards"]
                    .get(standard_id, {})
                    .get("points"),
                )
                for standard_id in resource_meta["standards"].keys()
            }
            if resource_meta.get("standards")
            else None,
        )

        # === BUILD MESSAGES (VIEW MODEL) ===
        messages_payload: list[MessageData] = []
        is_own_attempt = attempt_item.profile_id == profiles_id

        for msg in messages_result or []:
            msg_feedbacks: list[MessageFeedbackEntry] = []

            # Strengths (from parallel-fetched lookup)
            msg_strengths = strengths_by_message.get(msg.message_id, [])
            for idx, s in enumerate(msg_strengths):
                highlights: list[HighlightEntry] = []
                for h in highlights_by_strength.get(s.strength_id, []):
                    highlights.append(HighlightEntry(section=h.section, idx=h.idx))
                feedback_id = f"{msg.message_id}-strength-{idx}"
                msg_feedbacks.append(
                    MessageFeedbackEntry(
                        id=feedback_id,
                        name=s.name,
                        description=s.description,
                        type="strength",
                        highlights=highlights if highlights else None,
                        replaces=None,
                    )
                )

            # Improvements (from parallel-fetched lookup)
            msg_improvements = improvements_by_message.get(msg.message_id, [])
            for idx, i in enumerate(msg_improvements):
                replaces: list[ReplacementEntry] = []
                for r in replacements_by_improvement.get(i.improvement_id, []):
                    replaces.append(
                        ReplacementEntry(
                            section=r.section,
                            replace=r.replace_text,
                            idx=r.idx,
                        )
                    )
                feedback_id = f"{msg.message_id}-improvement-{idx}"
                msg_feedbacks.append(
                    MessageFeedbackEntry(
                        id=feedback_id,
                        name=i.name,
                        description=i.description,
                        type="improvement",
                        highlights=None,
                        replaces=replaces if replaces else None,
                    )
                )

            # Hints (from parallel-fetched lookup)
            msg_hints_list = hints_by_message.get(msg.message_id, [])
            hints: list[HintEntry] | None = (
                [HintEntry(hint=h.hint, idx=h.idx) for h in msg_hints_list]
                if msg_hints_list
                else None
            )

            # Contents (from parallel-fetched lookup)
            msg_contents = contents_by_message.get(msg.message_id, [])
            contents: list[ContentEntry] | None = None
            if msg_contents:
                contents = []
                for c in msg_contents:
                    persona_meta = (
                        resource_meta["personas"].get(c.persona_id, {})
                        if c.persona_id
                        else {}
                    )
                    persona_name = persona_meta.get("name")
                    persona_color = persona_meta.get("color")
                    persona_icon = persona_meta.get("icon")

                    if msg.type == "query":
                        name = "You" if is_own_attempt else profile_name
                        color = None
                        icon = "User"
                    else:
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

            messages_payload.append(
                MessageData(
                    id=msg.message_id,
                    chat_id=msg.chat_id,
                    type=msg.type,
                    created_at=(msg.created_at.isoformat() if msg.created_at else None),
                    completed=msg.completed,
                    contents=contents,
                    feedbacks=msg_feedbacks if msg_feedbacks else None,
                    hints=hints,
                )
            )

        # === BUILD CHATS (VIEW MODEL) ===
        chats: list[ChatData] = []
        for chat_item in chats_result or []:
            grade = None
            if chat_item.grade:
                rubric_meta = (
                    resource_meta["rubrics"].get(chat_item.rubric_id, {})
                    if chat_item.rubric_id
                    else {}
                )
                grade = GradeData(
                    score=chat_item.grade.score,
                    passed=chat_item.grade.passed,
                    time_taken=chat_item.grade.time_taken,
                    total_points=rubric_meta.get("total_points"),
                    pass_points=rubric_meta.get("pass_points"),
                )

            # Get grade object for this chat to look up feedbacks/analyses
            chat_grade_obj = grades_by_chat.get(chat_item.chat_id)
            chat_grade_id = chat_grade_obj.grade_id if chat_grade_obj else None

            # Feedbacks from simulation feedbacks view (keyed by grade_id)
            feedbacks: list[FeedbackEntry] = []
            chat_feedbacks = (
                feedbacks_by_grade.get(chat_grade_id, []) if chat_grade_id else []
            )
            for fb in chat_feedbacks:
                std_group_id = None
                if fb.standard_id:
                    std_meta = resource_meta["standards"].get(fb.standard_id, {})
                    std_group_id = std_meta.get("standard_group_id")
                feedbacks.append(
                    FeedbackEntry(
                        id=fb.feedback_id,
                        standard_id=fb.standard_id,
                        standard_group_id=std_group_id,
                        total=fb.total,
                        feedback=fb.feedback,
                    )
                )

            # Analyses from simulation analyses view (keyed by grade_id)
            analyses_entries: list[AnalysisEntry] | None = None
            chat_analyses = (
                analyses_by_grade.get(chat_grade_id, []) if chat_grade_id else []
            )
            if chat_analyses:
                analyses_entries = [
                    AnalysisEntry(content=a.content) for a in chat_analyses
                ]

            grading_state_data: GradingStateData | None = None
            if chat_item.grade or chat_feedbacks:
                achieved_dict: dict[str, bool] = {}
                passed_dict: dict[str, bool] = {}
                feedback_dict: dict[str, str] = {}

                if chat_feedbacks:
                    feedbacks_dicts = [
                        {"standard_id": fb.standard_id, "total": fb.total}
                        for fb in chat_feedbacks
                    ]

                    achieved_raw = compute_achieved_standards(feedbacks_dicts)
                    if achieved_raw:
                        for a in achieved_raw:
                            std_id = a.get("standard_id")
                            if std_id:
                                achieved_dict[str(std_id)] = a.get("achieved", False)

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

                    for fb in chat_feedbacks:
                        if fb.standard_id and fb.feedback:
                            feedback_dict[str(fb.standard_id)] = fb.feedback

                grading_state_data = GradingStateData(
                    achieved_standards=achieved_dict if achieved_dict else None,
                    passed_standards=passed_dict if passed_dict else None,
                    feedback_by_standard_id=feedback_dict if feedback_dict else None,
                )

            chats.append(
                ChatData(
                    id=chat_item.chat_id,
                    created_at=(
                        chat_item.created_at.isoformat()
                        if chat_item.created_at
                        else None
                    ),
                    completed=chat_item.completed,
                    grade=grade,
                    feedbacks=feedbacks,
                    analyses=analyses_entries,
                    show_problem_statement=chat_item.show_problem_statement,
                    show_objectives=chat_item.show_objectives,
                    copy_paste_allowed=chat_item.copy_paste_allowed,
                    text_enabled=chat_item.text_enabled,
                    audio_enabled=chat_item.audio_enabled,
                    grading_state=grading_state_data,
                    scenario_id=chat_item.scenario_id,
                    problem_statement_id=chat_item.problem_statement_id,
                    objective_ids=chat_item.objective_ids,
                    persona_ids=chat_item.persona_ids,
                    image_ids=chat_item.image_ids,
                    video_ids=chat_item.video_ids,
                    question_ids=chat_item.question_ids,
                    option_ids=chat_item.option_ids,
                    responses=(
                        [
                            QuizResponse(
                                question_id=r.question_id,
                                option_id=r.option_id,
                                completed=r.completed,
                                created_at=r.created_at,
                            )
                            for r in responses_by_chat.get(chat_item.chat_id, [])
                        ]
                        or None
                    ),
                    document_ids=chat_item.document_ids,
                    rubric_id=chat_item.rubric_id,
                    standard_group_ids=chat_item.standard_group_ids,
                    standard_ids=chat_item.standard_ids,
                )
            )

        attempt = AttemptData(
            id=attempt_item.attempt_id,
            created_at=(
                attempt_item.created_at.isoformat() if attempt_item.created_at else None
            ),
            infinite_mode=attempt_item.infinite_mode,
            profile_id=attempt_item.profile_id,
            profile_name=profile_name,
            department_id=attempt_item.department_id,
            cohort_id=attempt_item.cohort_id if not practice else None,
            is_archived=False if practice else None,
        )

        first_chat = chats_result[0] if chats_result else None
        simulation = SimulationData(
            id=attempt_item.simulation_id,
            name=simulation_name,
            description=None,
            time_limit=time_limit_seconds if time_limit_seconds > 0 else None,
            hints_enabled=first_chat.hints_enabled if first_chat else None,
            objectives_enabled=first_chat.show_objectives if first_chat else None,
            image_input_active=first_chat.show_images if first_chat else None,
            copy_paste_allowed=first_chat.copy_paste_allowed if first_chat else None,
            practice_simulation=practice,
            rubric_id=first_chat.rubric_id if first_chat else None,
        )

        compute_chat_position_and_current(chats)

        aggregates = compute_attempt_aggregates(chats)
        total_chats = aggregates["total_chats"]
        completed_chats = aggregates["completed_chats"]
        total_score = aggregates["total_score"]
        all_passed = aggregates["all_passed"]
        elapsed_seconds = aggregates["elapsed_seconds"]

        timer = _format_timer(
            elapsed=elapsed_seconds,
            limit_seconds=time_limit_seconds if time_limit_seconds > 0 else None,
            infinite_mode=attempt_item.infinite_mode or False,
            negative=allows_negative_time,
        )

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

        current_chat_index = compute_current_chat_index(chats)
        expected_chat_count = total_chats
        is_active = not timer.exceeded if timer else True

        rubric_structure: RubricStructureData | None = None
        if all_standard_group_ids or all_standard_ids:
            standard_groups_dict: dict[str, list[str]] = {}
            for std_id in set(all_standard_ids):
                std_meta = resource_meta["standards"].get(std_id, {})
                sg_id = std_meta.get("standard_group_id")
                if sg_id:
                    sg_id_str = str(sg_id)
                    if sg_id_str not in standard_groups_dict:
                        standard_groups_dict[sg_id_str] = []
                    standard_groups_dict[sg_id_str].append(str(std_id))

            standard_groups_mapping_dict: dict[str, StandardGroupMeta] = {}
            for sg_id in set(all_standard_group_ids):
                sg_meta = resource_meta["standard_groups"].get(sg_id, {})
                standard_groups_mapping_dict[str(sg_id)] = StandardGroupMeta(
                    name=sg_meta.get("name"),
                    description=sg_meta.get("description"),
                    points=sg_meta.get("points"),
                    pass_points=sg_meta.get("pass_points"),
                )

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
                standard_groups_mapping=standard_groups_mapping_dict
                if standard_groups_mapping_dict
                else None,
                standards_mapping=standards_mapping_dict
                if standards_mapping_dict
                else None,
            )

        all_chats_completed = all(chat.completed for chat in chats) if chats else False
        show_results = all_chats_completed
        should_show_controls = is_active and not all_chats_completed

        # === COMPUTE LOBBY STATE & CONTINUATION OPTIONS ===
        has_remaining = (
            expected_chat_count is not None
            and expected_chat_count > 0
            and completed_chats < expected_chat_count
        )
        is_lobby = (
            all_chats_completed
            and bool(has_remaining)
            and is_active
            and bool(chat_entry_id)
        )

        # Fetch continuation options only when in lobby (non-practice only)
        continuation_options = None
        if is_lobby and not practice and attempt_item.profile_id:
            try:
                prev_result = await get_attempt_list_internal(
                    conn,
                    profile_id_filter=attempt_item.profile_id,
                    simulation_id_filter=attempt_item.simulation_id,
                    practice_filter=False,
                )
                other_ids = [
                    a.attempt_id
                    for a in (prev_result.items or [])
                    if a.attempt_id != attempt_id
                ]
                if other_ids:
                    async with pool.acquire() as c:
                        prev_chats = await get_attempt_chats_internal(
                            c, attempt_ids=other_ids
                        )
                    # Build scenario name lookup from resource_meta
                    scenario_names: dict[str, str] = {}
                    for sid, meta in resource_meta.get("scenarios", {}).items():
                        name = meta.get("name") if isinstance(meta, dict) else None
                        if name:
                            scenario_names[str(sid)] = name
                    continuation_options = compute_continuation_options(
                        current_chats=chats_result or [],
                        previous_chats=prev_chats,
                        scenario_names=scenario_names,
                    )
            except Exception:
                # Don't fail the whole request if continuation computation fails
                continuation_options = None

        return AttemptInternalData(
            actor_name=profile_name,
            attempt_exists=True,
            access_denied=False,
            is_own_attempt=is_own_attempt,
            practice=practice,
            profiles_id=profiles_id,
            profile_name=profile_name,
            simulation_name=simulation_name,
            training_id=training_id,
            chat_entry_id=chat_entry_id,
            group_id=group_id,
            agent_ids=agent_ids,
            attempt_item=attempt_item,
            chats_result=chats_result,
            messages_result=messages_result,
            resource_meta=resource_meta,
            resources_payload=resources_payload,
            chats=chats,
            messages=messages_payload,
            attempt=attempt,
            simulation=simulation,
            timer=timer,
            aggregated_results=aggregated_results,
            current_chat_index=current_chat_index,
            expected_chat_count=expected_chat_count,
            is_active=is_active,
            is_lobby=is_lobby,
            show_results=show_results,
            should_show_controls=should_show_controls,
            rubric_structure=rubric_structure,
            continuation_options=continuation_options,
            config_agent_resources=config_agent_resources,
            config_model_resources=config_model_resources,
            config_provider_resources=config_provider_resources,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path="/api/v4/artifacts/attempt/get",
            operation="attempt_get_internal",
            sql_query="view_internals: attempts, chats, messages",
            sql_params=None,
            request=http_request,
        )
        # handle_route_error raises, but mypy needs a return
        raise  # pragma: no cover


# =============================================================================
# Layer 2a: HTTP client response (with caching)
# =============================================================================


async def get_attempt_client(
    conn: asyncpg.Connection,
    profile_id: UUID,
    attempt_id: UUID,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v4/artifacts/attempt/get",
    http_request: Request | None = None,
) -> tuple[GetAttemptDetailResponse, bool]:
    """HTTP response layer with caching.

    Calls get_attempt_internal() and assembles GetAttemptDetailResponse.
    Returns (response, cache_hit).
    """
    tags = ["attempt"]
    body_dict = GetAttemptDetailRequest(attempt_id=attempt_id).model_dump(mode="json")
    cache_key_val = cache_key(cache_key_path, body_dict)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetAttemptDetailResponse.model_validate(cached["data"]), True

    data = await get_attempt_internal(
        conn=conn,
        profile_id=profile_id,
        attempt_id=attempt_id,
        bypass_cache=bypass_cache,
        http_request=http_request,
    )

    # Early return for not-found / access-denied
    if not data.attempt_exists or data.access_denied:
        return (
            GetAttemptDetailResponse(
                attempt_exists=data.attempt_exists,
                access_denied=data.access_denied,
                actor_name=data.actor_name,
            ),
            False,
        )

    api_response = GetAttemptDetailResponse(
        actor_name=data.actor_name,
        attempt_exists=True,
        access_denied=False,
        attempt=data.attempt,
        simulation=data.simulation,
        timer=data.timer,
        aggregated_results=data.aggregated_results,
        current_chat_index=data.current_chat_index,
        expected_chat_count=data.expected_chat_count,
        is_active=data.is_active,
        is_lobby=data.is_lobby,
        show_results=data.show_results,
        should_show_controls=data.should_show_controls,
        is_own_attempt=data.is_own_attempt,
        available_continuation_options=data.continuation_options,
        rubric_structure=data.rubric_structure,
        training_id=data.training_id,
        chat_entry_id=data.chat_entry_id,
        resources=data.resources_payload,
        entries=AttemptEntries(
            attempt=[data.attempt_item] if data.attempt_item else None,
            attempt_chat=data.chats,
            attempt_message=data.messages,
        ),
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=tags,
    )

    return api_response, False


# =============================================================================
# Layer 2b: WebSocket response (config resources + tools)
# =============================================================================


async def get_attempt_websocket(
    conn: asyncpg.Connection,
    profile_id: UUID,
    attempt_id: UUID,
    bypass_cache: bool = False,
) -> GetAttemptWebsocketResponse:
    """WebSocket response layer with config resources.

    Calls get_attempt_internal() and assembles GetAttemptWebsocketResponse
    with content resources + config resources (agents, models, providers, tools).
    Also fetches config_profile (for rate limiting) and runs_today in parallel.
    """
    from datetime import UTC, datetime

    from app.api.v4.entries.runs.search import get_run_list_entries_internal

    data = await get_attempt_internal(
        conn=conn,
        profile_id=profile_id,
        attempt_id=attempt_id,
        bypass_cache=bypass_cache,
    )

    if not data.attempt_exists or data.access_denied:
        return GetAttemptWebsocketResponse()

    pool = get_pool()

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as c:
            return await get_profiles_internal(c, [profile_id], bypass_cache)

    async def fetch_runs_today():
        if not pool:
            return None
        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as c:
            return await get_run_list_entries_internal(
                conn=c,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    async def fetch_tools():
        if not data.config_agent_resources or not pool:
            return None
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            if agent.tool_ids:
                tool_ids.extend(agent.tool_ids)
        if not tool_ids:
            return None
        async with pool.acquire() as c:
            return await get_tools_internal(
                c, list(set(tool_ids)), bypass_cache=bypass_cache
            )

    config_profile_result, runs_result, config_tools = await asyncio.gather(
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_args = None
    config_args_outputs = None
    if config_tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)

        if all_args_ids or all_args_output_ids:

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_internal(
                        c, list(set(all_args_ids)), bypass_cache=bypass_cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs_internal(
                        c, list(set(all_args_output_ids)), bypass_cache=bypass_cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    # Build websocket resources (content + config)
    ws_resources = AttemptWebsocketResources(
        # Content resources from resources_payload
        scenarios=data.resources_payload.scenarios,
        personas=data.resources_payload.personas,
        documents=data.resources_payload.documents,
        images=data.resources_payload.images,
        videos=data.resources_payload.videos,
        objectives=data.resources_payload.objectives,
        questions=data.resources_payload.questions,
        options=data.resources_payload.options,
        problem_statements=data.resources_payload.problem_statements,
        rubrics=data.resources_payload.rubrics,
        standard_groups=data.resources_payload.standard_groups,
        standards=data.resources_payload.standards,
    )

    # Fetch previous insights
    from app.api.v4.entries.attempt_insights.search import (
        search_attempt_insights_entries_internal,
    )

    insights_result: list[dict] | None = None
    if pool:

        async def fetch_insights():
            async with pool.acquire() as c:
                return await search_attempt_insights_entries_internal(
                    c, limit_count=20, bypass_cache=bypass_cache
                )

        insights_result = await fetch_insights()

    websocket_config = WebsocketArtifacts(
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=config_tools,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
    )

    return GetAttemptWebsocketResponse(
        entries=AttemptEntries(
            attempt=[data.attempt_item] if data.attempt_item else None,
            attempt_chat=data.chats,
            attempt_message=data.messages,
            runs=runs_result,
            attempt_insights=insights_result or None,
        ),
        resources=ws_resources,
        artifacts=websocket_config,
        resource_agent_ids=data.agent_ids if data.agent_ids else None,
        group_id=data.group_id,
    )


# =============================================================================
# HTTP Route Handler
# =============================================================================


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
    - View 1: attempt (attempt-level aggregates)
    - View 2: attempt_chat (chat-level data with grades/feedbacks)
    - View 3: attempt_message (message-level data with strengths/improvements/hints)

    Each query runs on its own connection from the pool for true parallelism.
    The practice flag is determined from the attempt data itself.
    """
    tags = ["attempt"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id_str = http_request.state.profile_id
        if not profile_id_str:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )
        profile_id = UUID(profile_id_str)

        attempt_id = request.attempt_id

        response_data, cache_hit = await get_attempt_client(
            conn=conn,
            profile_id=profile_id,
            attempt_id=attempt_id,
            bypass_cache=bypass_cache,
            cache_key_path=http_request.url.path,
            http_request=http_request,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1" if cache_hit else "0"

        return response_data

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
