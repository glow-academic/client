"""run_positions endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.tools.call_args import record_call_args, resolve_tool
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    RunPositionsApiRequest,
    RunPositionsApiResponse,
    RunPositionsSqlParams,
    RunPositionsSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/resources/run_positions_complete.sql"


async def create_run_positions_internal(
    conn: asyncpg.Connection,
    runs_id: UUID,
    eval_id: UUID,
    value: int | None = None,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> UUID:
    """Create a run_position resource and return its ID.

    Can be called directly from other routes (e.g. duplicate endpoints)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = RunPositionsSqlParams(
        runs_id=runs_id, eval_id=eval_id, value=value, mcp=mcp,
        group_id=group_id, tool_id=tool_id
    )
    result = cast(
        RunPositionsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    if not result or not result.run_positions_id:
        raise ValueError("Failed to create run_position")

    # Record arg values if tracking is active (call_id returned by SQL)
    if result.call_id is not None:
        tool_info = await resolve_tool(
            conn, "create", "run_positions", scope="resources"
        )
        if tool_info:
            await record_call_args(
                conn, result.call_id, tool_info,
                {"runs_id": runs_id, "eval_id": eval_id, "value": value}, mcp
            )

    await invalidate_tags(["resources", "run_positions"])
    return result.run_positions_id


router = APIRouter()


@router.post(
    "/run_positions",
    response_model=RunPositionsApiResponse,
    dependencies=[
        audit_activity(
            "run_positions.created",
            "{{ actor.name }} created run_positions",
        )
    ],
)
async def create_run_positions(
    request: RunPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RunPositionsApiResponse:
    """Create run_positions resource (always INSERT)."""
    tags = ["resources", "run_positions"]

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
            # Frontend sends snake_case (run_positions) - auto-generated types match SQL function signature
            # Add mcp from header (not in request body)
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = RunPositionsSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                RunPositionsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.run_positions_id:
                raise ValueError("Failed to create run_positions")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                run_positions={"id": str(result.run_positions_id)},
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = RunPositionsApiResponse.model_validate(result.model_dump())

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
            operation="create_run_positions",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
