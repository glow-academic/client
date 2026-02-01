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
from collections import defaultdict
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.attempt.permissions import check_attempt_access
from app.api.v4.artifacts.attempt.types import (
    AggregatedResults,
    AttemptData,
    ChatData,
    ContentEntry,
    FeedbackEntry,
    GetAttemptDetailRequest,
    GetAttemptDetailResponse,
    GradeData,
    HighlightEntry,
    HintEntry,
    ImprovementEntry,
    MessageData,
    ReplacementEntry,
    SimulationData,
    StrengthEntry,
    TimerData,
)
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


def _format_timer(elapsed: int, limit: int | None, infinite_mode: bool) -> TimerData:
    """Format timer data."""
    if limit is None:
        return TimerData(
            elapsed=elapsed,
            limit=None,
            exceeded=False,
            formatted="",
        )

    limit_seconds = limit * 60
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

        # === EXECUTE ALL THREE QUERIES IN PARALLEL ===
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

        # Check if profile matches (permission check)
        if not check_attempt_access(attempt_item.profile_id, profile_id):
            return GetAttemptDetailResponse(
                attempt_exists=True,
                access_denied=True,
                actor_name=attempt_item.profile_name,
            )

        # Set audit context
        if attempt_item.profile_name:
            audit_set(
                http_request,
                actor={"name": attempt_item.profile_name, "id": profile_id},
            )

        # === GROUP MESSAGES BY CHAT_ID ===
        messages_by_chat: dict[UUID, list[Any]] = defaultdict(list)
        for msg in messages_result or []:
            messages_by_chat[msg.chat_id].append(msg)

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

                # Transform contents
                contents: list[ContentEntry] | None = None
                if msg.contents:
                    contents = []
                    for c in msg.contents:
                        contents.append(
                            ContentEntry(
                                id=c.id,
                                content=c.content,
                                persona_id=c.persona_id,
                                persona_name=c.persona_name,
                                persona_color=c.persona_color,
                                persona_icon=c.persona_icon,
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
            if chat_item.grade_id:
                grade = GradeData(
                    id=chat_item.grade_id,
                    score=chat_item.grade_score,
                    passed=chat_item.grade_passed,
                    description=chat_item.grade_description,
                    time_taken=chat_item.grade_time_taken,
                    total_points=chat_item.rubric_total_points,
                    pass_points=chat_item.rubric_pass_points,
                )

            # Transform feedbacks
            feedbacks: list[FeedbackEntry] = []
            if chat_item.feedbacks:
                for fb in chat_item.feedbacks:
                    feedbacks.append(
                        FeedbackEntry(
                            id=fb.id,
                            standard_id=fb.standard_id,
                            total=fb.total,
                            feedback=fb.feedback,
                        )
                    )

            chats.append(
                ChatData(
                    id=chat_item.chat_id,
                    scenario_id=chat_item.scenario_id,
                    scenario_name=chat_item.scenario_name,
                    problem_statement=chat_item.problem_statement,
                    show_problem_statement=True,
                    show_objectives=True,
                    objectives=chat_item.objective,
                    persona_id=chat_item.persona_id,
                    persona_name=chat_item.persona_name,
                    persona_icon=chat_item.persona_icon,
                    persona_color=chat_item.persona_color,
                    completed=chat_item.chat_completed,
                    is_current=chat_item.is_current_chat,
                    position=chat_item.chat_position,
                    grade=grade,
                    feedbacks=feedbacks,
                    messages=messages,
                )
            )

        # === BUILD ATTEMPT DATA ===
        attempt = AttemptData(
            id=attempt_item.attempt_id,
            created_at=(
                attempt_item.attempt_created_at.isoformat()
                if attempt_item.attempt_created_at
                else None
            ),
            infinite_mode=attempt_item.infinite_mode,
            profile_id=attempt_item.profile_id,
            profile_name=attempt_item.profile_name,
            department_id=attempt_item.department_id,
            # Home mode only
            cohort_id=attempt_item.cohort_id if not practice else None,
            # Practice mode only
            is_archived=False if practice else None,  # Practice attempts from view are not archived
        )

        # === BUILD SIMULATION DATA ===
        simulation = SimulationData(
            id=attempt_item.simulation_id,
            name=attempt_item.simulation_name,
            description=None,  # Not in view, would need to JOIN
            time_limit=None,  # Would need to be fetched separately if needed
            hints_enabled=None,
            objectives_enabled=None,
            image_input_active=None,
            copy_paste_allowed=None,
        )

        # === BUILD TIMER DATA ===
        timer = _format_timer(
            elapsed=attempt_item.elapsed_seconds or 0,
            limit=None,  # Would need to be fetched separately
            infinite_mode=attempt_item.infinite_mode or False,
        )

        # === BUILD AGGREGATED RESULTS ===
        total_score = attempt_item.total_score or 0
        total_chats = attempt_item.total_chats or 0
        completed_chats = attempt_item.completed_chats or 0
        rubric_total_points = attempt_item.rubric_total_points or 0

        total_possible = rubric_total_points * completed_chats if completed_chats > 0 else 0
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

        # === BUILD RESPONSE ===
        api_response = GetAttemptDetailResponse(
            actor_name=attempt_item.profile_name,
            attempt_exists=True,
            access_denied=False,
            attempt=attempt,
            simulation=simulation,
            chats=chats,
            timer=timer,
            aggregated_results=aggregated_results,
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
