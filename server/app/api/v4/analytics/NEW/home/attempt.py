"""Home attempt detail endpoint - POST /home/attempt.

Uses three-MV architecture with parallel query execution:
1. Query 1 (Attempt): Attempt-level data + resource joins
2. Query 2 (Chats): Chat-level data + resource joins
3. Query 3 (Messages): Message-level data (arrays already denormalized)

All three queries run in parallel using pool.acquire() for each,
then results are assembled in Python.
"""

import asyncio
from collections import defaultdict
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.analytics.NEW.home.types import (
    AggregatedResults,
    AttemptData,
    ChatData,
    FeedbackEntry,
    GetAttemptDetailRequest,
    GetAttemptDetailResponse,
    GradeData,
    HighlightEntry,
    ImprovementEntry,
    MessageData,
    ReplacementEntry,
    SimulationData,
    StrengthEntry,
    TimerData,
)
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


def _transform_feedbacks(feedbacks: list[Any] | None) -> list[FeedbackEntry]:
    """Transform SQL feedback tuples to FeedbackEntry objects."""
    if not feedbacks:
        return []
    result = []
    for fb in feedbacks:
        if fb is not None:
            result.append(
                FeedbackEntry(
                    id=fb[0] if len(fb) > 0 else None,
                    standard_id=fb[1] if len(fb) > 1 else None,
                    total=fb[2] if len(fb) > 2 else None,
                    feedback=fb[3] if len(fb) > 3 else None,
                )
            )
    return result


def _transform_highlights(highlights: list[Any] | None) -> list[HighlightEntry]:
    """Transform SQL highlight tuples to HighlightEntry objects."""
    if not highlights:
        return []
    result = []
    for h in highlights:
        if h is not None:
            result.append(
                HighlightEntry(
                    section=h[0] if len(h) > 0 else None,
                    idx=h[1] if len(h) > 1 else None,
                )
            )
    return result


def _transform_replacements(replacements: list[Any] | None) -> list[ReplacementEntry]:
    """Transform SQL replacement tuples to ReplacementEntry objects."""
    if not replacements:
        return []
    result = []
    for r in replacements:
        if r is not None:
            result.append(
                ReplacementEntry(
                    section=r[0] if len(r) > 0 else None,
                    replace_text=r[1] if len(r) > 1 else None,
                    idx=r[2] if len(r) > 2 else None,
                )
            )
    return result


def _transform_strengths(strengths: list[Any] | None) -> list[StrengthEntry]:
    """Transform SQL strength tuples to StrengthEntry objects."""
    if not strengths:
        return []
    result = []
    for s in strengths:
        if s is not None:
            result.append(
                StrengthEntry(
                    id=s[0] if len(s) > 0 else None,
                    message_id=s[1] if len(s) > 1 else None,
                    name=s[2] if len(s) > 2 else None,
                    description=s[3] if len(s) > 3 else None,
                    highlights=_transform_highlights(s[4] if len(s) > 4 else None),
                )
            )
    return result


def _transform_improvements(
    improvements: list[Any] | None,
) -> list[ImprovementEntry]:
    """Transform SQL improvement tuples to ImprovementEntry objects."""
    if not improvements:
        return []
    result = []
    for i in improvements:
        if i is not None:
            result.append(
                ImprovementEntry(
                    id=i[0] if len(i) > 0 else None,
                    message_id=i[1] if len(i) > 1 else None,
                    name=i[2] if len(i) > 2 else None,
                    description=i[3] if len(i) > 3 else None,
                    replacements=_transform_replacements(i[4] if len(i) > 4 else None),
                )
            )
    return result


@router.post(
    "/attempt",
    response_model=GetAttemptDetailResponse,
    dependencies=[
        audit_activity("home.new.attempt", "{{ actor.name }} viewed home attempt detail")
    ],
)
async def home_attempt_detail(
    request: GetAttemptDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptDetailResponse:
    """Get home attempt detail with parallel MV fetching.

    Uses three-MV architecture with pool-based parallel fetch:
    - MV 1: mv_home_attempts (attempt-level aggregates)
    - MV 2: mv_home_chats (chat-level data with grades/feedbacks)
    - MV 3: mv_home_messages (message-level data with strengths/improvements)

    Each query runs on its own connection from the pool for true parallelism.
    """
    tags = ["home", "new", "attempt"]

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
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        attempt_id = request.attempt_id

        # Get pool for parallel queries
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # === PARALLEL FETCH FUNCTIONS ===
        # Each function acquires its own connection for true parallelism

        async def fetch_attempt(aid: UUID, pid: UUID) -> list[asyncpg.Record]:
            async with pool.acquire() as c:
                return await c.fetch(
                    "SELECT * FROM api_get_home_attempt_v4($1, $2)",
                    aid,
                    pid,
                )

        async def fetch_chats(aid: UUID) -> list[asyncpg.Record]:
            async with pool.acquire() as c:
                return await c.fetch(
                    "SELECT * FROM api_get_home_attempt_chats_v4($1)",
                    aid,
                )

        async def fetch_messages(aid: UUID) -> list[asyncpg.Record]:
            async with pool.acquire() as c:
                return await c.fetch(
                    "SELECT * FROM api_get_home_attempt_messages_v4($1)",
                    aid,
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

        attempt_row = attempt_result[0] if attempt_result else None

        if not attempt_row:
            return GetAttemptDetailResponse(
                attempt_exists=False,
                access_denied=True,
                actor_name=None,
            )

        # Check permissions
        if not attempt_row.get("attempt_exists"):
            return GetAttemptDetailResponse(
                attempt_exists=False,
                access_denied=False,
                actor_name=attempt_row.get("actor_name"),
            )

        if attempt_row.get("access_denied"):
            return GetAttemptDetailResponse(
                attempt_exists=True,
                access_denied=True,
                actor_name=attempt_row.get("actor_name"),
            )

        # Set audit context
        if attempt_row.get("actor_name"):
            audit_set(
                http_request,
                actor={"name": attempt_row["actor_name"], "id": profile_id},
            )

        # === GROUP MESSAGES BY CHAT_ID ===
        messages_by_chat: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for msg in messages_result or []:
            chat_id = str(msg["chat_id"])
            messages_by_chat[chat_id].append(msg)

        # === BUILD CHATS WITH MESSAGES ===
        chats: list[ChatData] = []
        for chat_row in chats_result or []:
            chat_id = str(chat_row["chat_id"])
            chat_messages = messages_by_chat.get(chat_id, [])

            # Transform messages
            messages: list[MessageData] = []
            for msg in chat_messages:
                messages.append(
                    MessageData(
                        id=msg["message_id"],
                        content=msg.get("content"),
                        type=msg.get("type"),
                        created_at=(
                            msg["created_at"].isoformat()
                            if msg.get("created_at")
                            else None
                        ),
                        completed=msg.get("completed"),
                        strengths=_transform_strengths(msg.get("strengths")),
                        improvements=_transform_improvements(msg.get("improvements")),
                    )
                )

            # Build grade data
            grade = None
            if chat_row.get("grade_id"):
                grade = GradeData(
                    id=chat_row["grade_id"],
                    score=chat_row.get("grade_score"),
                    passed=chat_row.get("grade_passed"),
                    description=chat_row.get("grade_description"),
                    time_taken=chat_row.get("grade_time_taken"),
                    total_points=chat_row.get("rubric_total_points"),
                    pass_points=chat_row.get("rubric_pass_points"),
                )

            chats.append(
                ChatData(
                    id=chat_row["chat_id"],
                    scenario_id=chat_row.get("scenario_id"),
                    scenario_name=chat_row.get("scenario_name"),
                    problem_statement=chat_row.get("problem_statement"),
                    show_problem_statement=chat_row.get("show_problem_statement"),
                    show_objectives=chat_row.get("show_objectives"),
                    objectives=chat_row.get("objectives"),
                    persona_id=chat_row.get("persona_id"),
                    persona_name=chat_row.get("persona_name"),
                    persona_icon=chat_row.get("persona_icon"),
                    persona_color=chat_row.get("persona_color"),
                    completed=chat_row.get("chat_completed"),
                    is_current=chat_row.get("is_current_chat"),
                    position=chat_row.get("chat_position"),
                    grade=grade,
                    feedbacks=_transform_feedbacks(chat_row.get("feedbacks")),
                    messages=messages,
                )
            )

        # === BUILD ATTEMPT DATA ===
        attempt = AttemptData(
            id=attempt_row["out_attempt_id"],
            created_at=(
                attempt_row["attempt_created_at"].isoformat()
                if attempt_row.get("attempt_created_at")
                else None
            ),
            infinite_mode=attempt_row.get("infinite_mode"),
            profile_id=attempt_row.get("profile_id_out"),
            profile_name=attempt_row.get("profile_name"),
            cohort_id=attempt_row.get("cohort_id"),
            department_id=attempt_row.get("department_id"),
        )

        # === BUILD SIMULATION DATA ===
        simulation = SimulationData(
            id=attempt_row.get("simulation_id"),
            name=attempt_row.get("simulation_name"),
            description=attempt_row.get("simulation_description"),
            time_limit=attempt_row.get("time_limit"),
            hints_enabled=attempt_row.get("hints_enabled"),
            objectives_enabled=attempt_row.get("objectives_enabled"),
            image_input_active=attempt_row.get("image_input_active"),
            copy_paste_allowed=attempt_row.get("copy_paste_allowed"),
        )

        # === BUILD TIMER DATA ===
        timer = _format_timer(
            elapsed=attempt_row.get("elapsed_seconds") or 0,
            limit=attempt_row.get("time_limit"),
            infinite_mode=attempt_row.get("infinite_mode") or False,
        )

        # === BUILD AGGREGATED RESULTS ===
        total_score = attempt_row.get("total_score") or 0
        total_chats = attempt_row.get("total_chats") or 0
        completed_chats = attempt_row.get("completed_chats") or 0
        rubric_total_points = attempt_row.get("rubric_total_points") or 0

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
            passed=attempt_row.get("all_passed"),
            chats_completed=completed_chats,
            total_chats=total_chats,
        )

        # === BUILD RESPONSE ===
        api_response = GetAttemptDetailResponse(
            actor_name=attempt_row.get("actor_name"),
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
            operation="home_new_attempt",
            sql_query="api_get_home_attempt_v4 / api_get_home_attempt_chats_v4 / api_get_home_attempt_messages_v4",
            sql_params=None,
            request=http_request,
        )
