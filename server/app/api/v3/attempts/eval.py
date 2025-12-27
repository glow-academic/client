"""Eval attempt endpoint - returns complete eval attempt data with runs and status."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql


# Inline request/response schemas
class EvalAttemptFullRequest(BaseModel):
    """Request to get eval attempt full details."""

    attemptId: str
    # profileId removed - comes from X-Profile-Id header


class RunItem(BaseModel):
    """Run item in eval attempt."""

    run_id: str
    status: str  # 'not_started', 'in_progress', 'completed'
    test_id: str | None = None
    eval_run_completed: bool
    eval_run_assigned_at: str
    eval_run_updated_at: str
    run_created_at: str
    model_id: str | None = None
    model_name: str | None = None
    agent_id: str | None = None
    agent_name: str | None = None
    persona_id: str | None = None
    persona_name: str | None = None
    profile_id: str | None = None
    profile_name: str | None = None
    grade_score: int | None = None
    grade_passed: bool | None = None
    grade_created_at: str | None = None


class AttemptItem(BaseModel):
    """Eval attempt item."""

    id: str
    created_at: str
    eval_id: str
    archived: bool
    conversation_mode: bool = False
    conversation_agent_id: str | None = None
    conversation_max_turns: int | None = None


class EvalItem(BaseModel):
    """Eval item in attempt response."""

    eval_id: str
    name: str
    description: str
    rubric_id: str
    agent_id: str
    eval_agent_id: str
    dynamic: bool = False
    rubric_name: str
    rubric_description: str
    system_prompt: str = ""
    conversation_agent_name: str | None = None


class StatusSummary(BaseModel):
    """Status summary for eval attempt."""

    not_started: int
    in_progress: int
    completed: int
    total: int


class EvalAttemptFullResponse(BaseModel):
    """Response for eval attempt full endpoint."""

    attempt: AttemptItem
    eval: EvalItem
    runs: list[RunItem]
    status_summary: StatusSummary


router = APIRouter()


@router.post(
    "/eval",
    response_model=EvalAttemptFullResponse,
    dependencies=[
        audit_activity(
            "attempt.eval.viewed", "{{ actor.name }} viewed eval attempt details"
        )
    ],
)
async def get_eval_attempt_full(
    request: EvalAttemptFullRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> EvalAttemptFullResponse:
    """Get complete eval attempt data with all runs and status."""
    tags = ["attempts"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return EvalAttemptFullResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Load SQL string
        sql_query = load_sql("app/sql/v3/attempts/get_eval_attempt_complete.sql")
        sql_params = (request.attemptId, profile_id)
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Eval attempt not found: {request.attemptId}"
            )

        actor_name = result.get("actor_name")
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Parse JSONB fields from strings to Python objects
        def parse_jsonb(data: Any) -> Any:  # noqa: ANN401
            if isinstance(data, str):
                return json.loads(data)
            return data

        def safe_int_convert(value: Any) -> int | None:  # noqa: ANN401
            """Safely convert value to int, returning None if conversion fails."""
            if value is None:
                return None
            if isinstance(value, int):
                return value
            if isinstance(value, (str, float)):
                try:
                    return int(value)
                except (ValueError, TypeError):
                    return None
            return None

        attempt_data = parse_jsonb(result.get("attempt"))
        eval_data = parse_jsonb(result.get("eval"))
        runs_data = parse_jsonb(result.get("runs"))
        status_summary_data = parse_jsonb(result.get("status_summary"))

        if not attempt_data or not eval_data:
            raise HTTPException(
                status_code=404, detail=f"Eval attempt not found: {request.attemptId}"
            )

        # Build response
        conversation_max_turns_value = attempt_data.get("conversation_max_turns")
        conversation_max_turns_int: int | None = None
        if conversation_max_turns_value is not None:
            if isinstance(conversation_max_turns_value, int):
                conversation_max_turns_int = conversation_max_turns_value
            elif isinstance(conversation_max_turns_value, str):
                try:
                    conversation_max_turns_int = int(conversation_max_turns_value)
                except (ValueError, TypeError):
                    conversation_max_turns_int = None

        attempt_item = AttemptItem(
            id=str(attempt_data.get("id", "")),
            created_at=str(attempt_data.get("created_at", "")),
            eval_id=str(attempt_data.get("eval_id", "")),
            archived=bool(attempt_data.get("archived", False)),
            conversation_mode=bool(attempt_data.get("conversation_mode", False)),
            conversation_agent_id=str(attempt_data.get("conversation_agent_id"))
            if attempt_data.get("conversation_agent_id")
            else None,
            conversation_max_turns=conversation_max_turns_int,
        )

        eval_item = EvalItem(
            eval_id=str(eval_data.get("eval_id", "")),
            name=str(eval_data.get("name", "")),
            description=str(eval_data.get("description", "")),
            rubric_id=str(eval_data.get("rubric_id", "")),
            agent_id=str(eval_data.get("agent_id", "")),
            eval_agent_id=str(eval_data.get("eval_agent_id", "")),
            dynamic=bool(eval_data.get("dynamic", False)),
            rubric_name=str(eval_data.get("rubric_name", "")),
            rubric_description=str(eval_data.get("rubric_description", "")),
            system_prompt=str(eval_data.get("system_prompt", "")),
            conversation_agent_name=str(eval_data.get("conversation_agent_name"))
            if eval_data.get("conversation_agent_name")
            else None,
        )

        runs_list: list[RunItem] = []
        if runs_data and isinstance(runs_data, list):
            for run in runs_data:
                if isinstance(run, dict):
                    runs_list.append(
                        RunItem(
                            run_id=str(run.get("run_id", "")),
                            status=str(run.get("status", "not_started")),
                            test_id=str(run.get("test_id"))
                            if run.get("test_id")
                            else None,
                            eval_run_completed=bool(
                                run.get("eval_run_completed", False)
                            ),
                            eval_run_assigned_at=str(
                                run.get("eval_run_assigned_at", "")
                            ),
                            eval_run_updated_at=str(run.get("eval_run_updated_at", "")),
                            run_created_at=str(run.get("run_created_at", "")),
                            model_id=str(run.get("model_id"))
                            if run.get("model_id")
                            else None,
                            model_name=str(run.get("model_name"))
                            if run.get("model_name")
                            else None,
                            agent_id=str(run.get("agent_id"))
                            if run.get("agent_id")
                            else None,
                            agent_name=str(run.get("agent_name"))
                            if run.get("agent_name")
                            else None,
                            persona_id=str(run.get("persona_id"))
                            if run.get("persona_id")
                            else None,
                            persona_name=str(run.get("persona_name"))
                            if run.get("persona_name")
                            else None,
                            profile_id=str(run.get("profile_id"))
                            if run.get("profile_id")
                            else None,
                            profile_name=str(run.get("profile_name"))
                            if run.get("profile_name")
                            else None,
                            grade_score=safe_int_convert(run.get("grade_score")),
                            grade_passed=bool(run.get("grade_passed"))
                            if run.get("grade_passed") is not None
                            else None,
                            grade_created_at=str(run.get("grade_created_at"))
                            if run.get("grade_created_at")
                            else None,
                        )
                    )

        def safe_int(value: Any, default: int = 0) -> int:  # noqa: ANN401
            if value is None:
                return default
            if isinstance(value, int):
                return value
            if isinstance(value, (str, float)):
                try:
                    return int(value)
                except (ValueError, TypeError):
                    return default
            return default

        status_summary_item = StatusSummary(
            not_started=safe_int(
                status_summary_data.get("not_started", 0) if status_summary_data else 0
            ),
            in_progress=safe_int(
                status_summary_data.get("in_progress", 0) if status_summary_data else 0
            ),
            completed=safe_int(
                status_summary_data.get("completed", 0) if status_summary_data else 0
            ),
            total=safe_int(
                status_summary_data.get("total", 0) if status_summary_data else 0
            ),
        )

        response_data = EvalAttemptFullResponse(
            attempt=attempt_item,
            eval=eval_item,
            runs=runs_list,
            status_summary=status_summary_item,
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
            route_path=http_request.url.path,
            operation="get_eval_attempt_full",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

