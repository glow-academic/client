"""Parameter duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicateParameterRequest(BaseModel):
    """Request to duplicate parameter."""

    parameterId: str
    # profileId removed - comes from X-Profile-Id header


class DuplicateParameterResponse(BaseModel):
    """Response from duplicate parameter."""

    success: bool
    parameterId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateParameterResponse,
    dependencies=[
        audit_activity(
            "parameter.duplicated",
            "{{ actor.name }} duplicated parameter '{{ parameter.name }}'",
        )
    ],
)
async def duplicate_parameter(
    request: DuplicateParameterRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateParameterResponse:
    """Duplicate a parameter with all items and their department associations."""
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
            # Duplicate parameter with items and department links in single SQL (DHH style)
            sql_query = load_sql("sql/v3/parameters/duplicate_parameter_complete.sql")
            sql_params = (request.parameterId, profile_id)
            new_parameter = await conn.fetchrow(
                sql_query, request.parameterId, profile_id
            )

            if not new_parameter:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            new_parameter_id = new_parameter["parameter_id"]
            original_name = new_parameter.get("original_name")
            actor_name = new_parameter.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name and original_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    parameter={"name": original_name, "id": request.parameterId},
                )

            result_data = DuplicateParameterResponse(
                success=True,
                parameterId=new_parameter_id,
                message=f"Parameter '{original_name}' duplicated successfully",
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
            operation="duplicate_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
