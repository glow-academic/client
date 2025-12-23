"""Eval attempts list endpoint - v3 API following DHH principles."""

import uuid
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
class EvalAttemptsFilters(BaseModel):
    """Filters for eval attempts list request."""

    # profileId removed - comes from X-Profile-Id header
    evalIds: list[str] | None = None
    status: str | None = None  # 'pending', 'running', 'completed'
    archived: bool | None = None
    search: str | None = None
    page: int = 0
    pageSize: int = 20


class EvalAttemptItem(BaseModel):
    """Individual eval attempt item in the response."""

    attempt_id: str
    eval_id: str
    eval_name: str
    eval_description: str
    rubric_id: str
    rubric_name: str
    created_at: str
    archived: bool
    status: str  # 'pending', 'running', 'completed'
    total_runs: int
    completed_runs: int
    pending_runs: int


class EvalAttemptsListResponse(BaseModel):
    """Response for eval attempts list endpoint."""

    attempts: list[EvalAttemptItem]
    total_count: int
    page: int
    page_size: int
    total_pages: int


router = APIRouter()


@router.post(
    "/list",
    response_model=EvalAttemptsListResponse,
    dependencies=[
        audit_activity(
            "eval.attempts_listed", "{{ actor.name }} viewed eval attempts list"
        )
    ],
)
async def get_eval_attempts_list(
    filters: EvalAttemptsFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> EvalAttemptsListResponse:
    """Get eval attempts list with pagination, filtering, and status information."""
    tags = ["evals", "attempts"]

    # Check for cache bypass header (for testing)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return EvalAttemptsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert evalIds to UUID array if provided
        eval_ids = None
        if filters.evalIds:
            try:
                eval_ids = [uuid.UUID(eid) for eid in filters.evalIds]
            except ValueError as e:
                raise HTTPException(
                    status_code=400, detail=f"Invalid eval ID format: {e}"
                ) from e

        # Load SQL string
        sql_query = load_sql("app/sql/v3/evals/list_attempts.sql")
        sql_params = (
            profile_id,
            eval_ids if eval_ids else None,
            filters.status,
            filters.archived,
            filters.search,
            filters.page,
            filters.pageSize,
        )

        # Execute query
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to query eval attempts")

        actor_name = result.get("actor_name")
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        # Parse attempts list
        attempts: list[EvalAttemptItem] = []
        attempts_data = result.get("attempts")
        if isinstance(attempts_data, list):
            for attempt in attempts_data:
                if isinstance(attempt, dict):
                    attempts.append(EvalAttemptItem.model_validate(attempt))

        total_count = int(result.get("total_count", 0))
        page = int(result.get("page", filters.page))
        page_size = int(result.get("page_size", filters.pageSize))
        total_pages = int(result.get("total_pages", 0))

        response_data = EvalAttemptsListResponse(
            attempts=attempts,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
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
            route_path=request.url.path,
            operation="get_eval_attempts_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
