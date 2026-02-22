"""profile_personas endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    ProfilePersonasApiRequest,
    ProfilePersonasApiResponse,
    ProfilePersonasSqlParams,
    ProfilePersonasSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/resources/profile_personas_complete.sql"


router = APIRouter()


@router.post(
    "/profile_personas",
    response_model=ProfilePersonasApiResponse,
    dependencies=[
        audit_activity(
            "profile_personas.created",
            "{{ actor.name }} created profile_personas",
        )
    ],
)
async def create_profile_personas(
    request: ProfilePersonasApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfilePersonasApiResponse:
    """Create profile_personas resource (always INSERT)."""
    tags = ["resources", "profile_personas"]

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

            # Convert API request to SQL params (use double star pattern)
            # Add mcp from header (not in request body)
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = ProfilePersonasSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                ProfilePersonasSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.id:
                raise ValueError("Failed to create profile_personas")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                profile_personas={"id": str(result.id)},
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = ProfilePersonasApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except asyncpg.ForeignKeyViolationError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Referenced entity does not exist: {e}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_profile_personas",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
