"""Parameter delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeleteParameterRequest(BaseModel):
    """Request to delete parameter."""

    parameterId: str
    # profileId removed - comes from X-Profile-Id header


class DeleteParameterResponse(BaseModel):
    """Response from delete parameter."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteParameterResponse,
    dependencies=[
        audit_activity("parameter.deleted", "{{ actor.name }} deleted parameter '{{ parameter.name }}'")
    ],
)
async def delete_parameter(
    request: DeleteParameterRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteParameterResponse:
    """Delete a parameter if items not in use."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation

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

        async with transaction(conn):
            # Delete parameter with usage check in single SQL (DHH style)
            sql_query = load_sql("sql/v3/parameters/delete_parameter_complete.sql")
            sql_params = (request.parameterId, profile_id)
            result = await conn.fetchrow(sql_query, request.parameterId, profile_id)

            if not result:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            usage_count = result.get("usage_count", 0)
            if usage_count > 0:
                raise ValueError(
                    "Cannot delete parameter: Some items are in use by scenarios"
                )

            parameter_name = result.get("name")
            actor_name = result.get("actor_name")
            if not parameter_name:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    parameter={"name": parameter_name, "id": request.parameterId},
                )

            result_data = DeleteParameterResponse(
                success=True,
                message=f"Parameter '{parameter_name}' deleted successfully",
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
