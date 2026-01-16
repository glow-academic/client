"""Profile authorize emulation endpoint - check if emulation is authorized."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    AuthorizeEmulationApiRequest,
    AuthorizeEmulationApiResponse,
    AuthorizeEmulationSqlParams,
    AuthorizeEmulationSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/profile/authorize_emulation_complete.sql"

router = APIRouter()


@router.post(
    "/emulate",
    response_model=AuthorizeEmulationApiResponse,
    dependencies=[
        audit_activity("profile.emulate", "{{ actor.name }} authorized emulation")
    ],
)
async def authorize_emulation(
    request: AuthorizeEmulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AuthorizeEmulationApiResponse:
    """Check if emulation is authorized."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert API request to SQL params using double star pattern
        # Note: requester_profile_id and target_profile_id are UUIDs from auto-generated types
        params = AuthorizeEmulationSqlParams(**request.model_dump())
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            AuthorizeEmulationSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context using actor_name from SQL result
        if result.actor_name:
            # Use requester_profile_id for actor (the one requesting emulation)
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": request.requester_profile_id},
            )

        # Convert SQL result to API response
        api_response = AuthorizeEmulationApiResponse.model_validate(result.model_dump())

        # Invalidate cache after authorization check (may affect profile context)
        tags = ["profile"]  # From router tags
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="authorize_emulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
