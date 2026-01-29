"""Agent delete endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DeleteAgentApiRequest,
    DeleteAgentApiResponse,
    DeleteAgentSqlParams,
    DeleteAgentSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/agents/delete_agent_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteAgentApiResponse,
    dependencies=[
        audit_activity(
            "agent.deleted", "{{ actor.name }} deleted agent '{{ agent.name }}'"
        )
    ],
)
async def delete_agent(
    request: DeleteAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAgentApiResponse:
    """Delete an agent."""
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

        # Convert API request to SQL params (add profile_id from header)
        params = DeleteAgentSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            DeleteAgentSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if result.usage_count and result.usage_count > 0:
            raise HTTPException(
                status_code=400, detail="Cannot delete agent: agent is in use"
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                agent={"name": result.name, "id": str(request.agent_id)},
            )

        # Convert SQL result to API response
        # Note: API response matches SQL response structure (usage_count, deleted, name, actor_name)
        api_response = DeleteAgentApiResponse.model_validate(result.model_dump())

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
            operation="delete_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
