"""Agent update endpoint."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    UpdateAgentApiRequest,
    UpdateAgentApiResponse,
    UpdateAgentSqlParams,
    UpdateAgentSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/agents/update_agent_complete.sql"


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateAgentApiResponse,
    dependencies=[
        audit_activity(
            "agent.updated", "{{ actor.name }} updated agent '{{ agent.name }}'"
        )
    ],
)
async def update_agent(
    request: UpdateAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateAgentApiResponse:
    """Update an agent."""
    tags = ["agents"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Validate model_id is not empty and is a valid UUID
        if not request.model_id or not str(request.model_id).strip():
            raise HTTPException(
                status_code=400, detail="model_id is required and cannot be empty"
            )

        # Validate model_id is a valid UUID format
        try:
            uuid.UUID(str(request.model_id).strip())
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=400,
                detail=f"model_id must be a valid UUID, got: {request.model_id!r}",
            ) from None

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            # Pydantic models handle array defaults via Field(default_factory=list)
            params = UpdateAgentSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                UpdateAgentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result.agent_id:
                raise HTTPException(
                    status_code=404, detail="Agent not found or update not permitted"
                )

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    agent={"name": request.name, "id": str(request.agent_id)},
                )

            # Convert SQL result to API response
            api_response = UpdateAgentApiResponse.model_validate(result.model_dump())

        # Response already created above

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
