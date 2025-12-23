"""Profile delete endpoint - delete a profile."""

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql

router = APIRouter()


class DeleteProfileRequest(BaseModel):
    """Request to delete profile."""

    profileId: str


class DeleteProfileResponse(BaseModel):
    """Response from delete profile."""

    success: bool
    message: str


@router.post(
    "/delete",
    response_model=DeleteProfileResponse,
    dependencies=[
        audit_activity(
            "profile.deleted", "{{ actor.name }} deleted profile '{{ profile.name }}'"
        )
    ],
)
async def delete_profile(
    request: DeleteProfileRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteProfileResponse:
    """Delete a profile."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Single consolidated query: checks existence/default, gets name, and deletes
        sql_query = load_sql("app/sql/v3/profile/staff/delete_profile_complete.sql")
        sql_params = (request.profileId, current_profile_id)

        result = await conn.fetchrow(sql_query, request.profileId, current_profile_id)

        if not result or not result["id"]:
            raise HTTPException(
                status_code=404, detail=f"Profile not found: {request.profileId}"
            )

        # Verify deletion occurred (query performs the delete)
        if not result.get("deleted", False):
            raise HTTPException(status_code=500, detail="Failed to delete profile")

        # Set audit context with data from SQL query
        actor_name = result.get("actor_name")
        profile_name = result.get("name")
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": current_profile_id},
                profile={"name": profile_name, "id": request.profileId},
            )

        result_data = DeleteProfileResponse(
            success=True, message=f"Profile '{result['name']}' deleted successfully"
        )

        # Invalidate cache after mutation
        tags = ["profile"]  # Profile operations
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
