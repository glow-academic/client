"""setting_role_routes endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    RoleRoutesApiRequest,
    RoleRoutesApiResponse,
    RoleRoutesSqlParams,
    RoleRoutesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/resources/role_routes_complete.sql"


router = APIRouter()


@router.post(
    "/setting_role_routes",
    response_model=RoleRoutesApiResponse,
    dependencies=[
        audit_activity(
            "role_routes.created",
            "{{ actor.name }} created role_routes",
        )
    ],
)
async def create_setting_role_routes(
    request: RoleRoutesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RoleRoutesApiResponse:
    """Create role_routes resource (always INSERT)."""
    tags = ["resources", "role_routes"]

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

        async with conn.transaction():
            # Get mcp flag from header (set by router-level dependency)
            mcp = getattr(http_request.state, "mcp", False) or False

            # Convert API request to SQL params
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = RoleRoutesSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                RoleRoutesSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.role_routes_id:
                raise ValueError("Failed to create role_routes")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                role_routes={"id": str(result.role_routes_id)},
            )

        # Convert SQL result to API response
        api_response = RoleRoutesApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_setting_role_routes",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
