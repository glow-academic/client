"""endpoints endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.tools.call_args import record_call_args, resolve_tool
from app.main import get_db
from app.v5.sql.types import (
    EndpointsApiRequest,
    EndpointsApiResponse,
    EndpointsSqlParams,
    EndpointsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/v5/sql/queries/resources/endpoints_complete.sql"


async def create_endpoints_internal(
    conn: asyncpg.Connection,
    base_url: str,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> UUID:
    """Create an endpoint resource and return its ID.

    When group_id is provided, creates run/call/tool tracking records.
    Tool is auto-resolved if tool_id is not provided.
    """
    # Resolve tool if not provided (canonical — matches entry pattern)
    tool_info = None
    if tool_id is None:
        tool_info = await resolve_tool(conn, "create", "endpoints", scope="resources")
        if tool_info:
            tool_id = tool_info.tool_id

    params = EndpointsSqlParams(
        base_url=base_url, mcp=mcp, group_id=group_id, tool_id=tool_id
    )
    result = cast(
        EndpointsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    if not result or not result.endpoints_id:
        raise ValueError(f"Failed to create endpoint: {base_url}")

    # Record arg values (canonical — matches entry pattern)
    if tool_info is None and tool_id is not None:
        tool_info = await resolve_tool(conn, "create", "endpoints", scope="resources")
    if tool_info and result.call_id is not None:
        await record_call_args(
            conn, result.call_id, tool_info, {"base_url": base_url}, mcp
        )

    await invalidate_tags(["resources", "endpoints"])
    return result.endpoints_id


router = APIRouter()


@router.post("/endpoints", response_model=EndpointsApiResponse)
async def create_endpoints(
    request: EndpointsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> EndpointsApiResponse:
    """Create endpoints resource (always INSERT)."""
    tags = ["resources", "endpoints"]

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
            # Frontend sends snake_case (endpoints) - auto-generated types match SQL function signature
            # Add mcp from header (not in request body)
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = EndpointsSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                EndpointsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.endpoints_id:
                raise ValueError("Failed to create endpoints")

        # Convert SQL result to API response (auto-generated types)
        api_response = EndpointsApiResponse.model_validate(result.model_dump())

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
            operation="create_endpoints",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
