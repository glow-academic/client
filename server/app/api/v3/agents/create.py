"""Agent create endpoint."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreateAgentApiRequest,
    CreateAgentApiResponse,
    CreateAgentSqlParams,
    CreateAgentSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/create_agent_complete.sql"


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateAgentApiResponse,
    dependencies=[
        audit_activity(
            "agent.created", "{{ actor.name }} created agent '{{ agent.name }}'"
        )
    ],
)
async def create_agent(
    request: CreateAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAgentApiResponse:
    """Create a new agent."""
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
            # Ensure arrays are never None (use empty list as default)
            request_dict = request.model_dump()
            if not request_dict.get("department_ids"):
                request_dict["department_ids"] = []
            if not request_dict.get("model_voice_ids"):
                request_dict["model_voice_ids"] = []
            
            params = CreateAgentSqlParams(**request_dict, profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper (unified query handles all inserts)
            result = cast(
                CreateAgentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            agent_id = result.agent_id
            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    agent={"name": request.name, "id": agent_id},
                )

        # Convert SQL result to API response
        api_response = CreateAgentApiResponse.model_validate(result.model_dump())

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
            operation="create_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
