"""Problem resolve endpoint."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ResolveProblemRequest(BaseModel):
    problem_id: UUID
    resolved: bool = True


class ResolveProblemResponse(BaseModel):
    problem_id: UUID
    resolved: bool
    updated_at: datetime


router = APIRouter(tags=["activity"])


@router.post("/resolve", response_model=ResolveProblemResponse)
async def resolve_problem(
    request: ResolveProblemRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ResolveProblemResponse:
    """Resolve or unresolve a problem entry."""
    tags = ["problems", "views", "activity", "summary"]
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

        # Execute update query
        sql_query = load_sql("app/sql/v4/queries/activity/resolve_problem_complete.sql")
        sql_params = (str(request.problem_id), request.resolved, profile_id)
        result = await conn.fetchrow(
            sql_query, request.problem_id, request.resolved, profile_id
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Problem not found or you don't have permission to resolve it",
            )

        actor_name = result.get("actor_name")

        result_data = ResolveProblemResponse(
            problem_id=result["problem_id"],
            resolved=result["resolved"],
            updated_at=result["updated_at"],
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="resolve_problem",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
