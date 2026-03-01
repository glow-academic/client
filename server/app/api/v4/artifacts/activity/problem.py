"""Problem create endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreateProblemRequest(BaseModel):
    type: str
    message: str


class CreateProblemResponse(BaseModel):
    problem_id: str  # UUID
    success: bool
    message: str


router = APIRouter(tags=["activity"])


@router.post("/problem", response_model=CreateProblemResponse)
async def create_problem(
    request: CreateProblemRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProblemResponse:
    """Create new problem entry."""
    tags = ["problems", "views", "activity"]
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Validate problem type
        valid_types = ["feature", "bug", "question", "other"]
        if request.type not in valid_types:
            raise HTTPException(
                status_code=400, detail=f"Invalid problem type: {request.type}"
            )

        # Validate message
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message is required")

        if len(request.message) > 1000:
            raise HTTPException(
                status_code=400, detail="Message must be less than 1000 characters"
            )

        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Execute insert query
        sql_query = load_sql("app/sql/v4/queries/activity/create_problem_complete.sql")
        sql_params = (request.type, request.message, profile_id)
        result = await conn.fetchrow(
            sql_query, request.type, request.message, profile_id
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create problem")

        actor_name = result.get("actor_name")

        result_data = CreateProblemResponse(
            problem_id=str(result["problem_id"]),
            success=True,
            message="Problem created successfully",
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
            operation="create_problem",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
