"""examples endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.infra.v4.tools.call_args import record_call_args, resolve_tool
from app.sql.types import (
    ExamplesApiRequest,
    ExamplesApiResponse,
    ExamplesSqlParams,
    ExamplesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/resources/examples_complete.sql"


async def create_examples_internal(
    conn: asyncpg.Connection,
    example: str,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> UUID:
    """Create an example resource and return its ID.

    When group_id and tool_id are provided, creates run/call/tool tracking
    records in SQL and records arg values in Python.
    """
    params = ExamplesSqlParams(
        example=example, mcp=mcp, group_id=group_id, tool_id=tool_id
    )
    result = cast(
        ExamplesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    if not result or not result.example_id:
        raise ValueError(f"Failed to create example: {example}")

    # Record arg values if tracking is active (call_id returned by SQL)
    if result.call_id is not None:
        tool_info = await resolve_tool(
            conn, "create", "examples", scope="resources"
        )
        if tool_info:
            await record_call_args(
                conn, result.call_id, tool_info, {"example": example}, mcp
            )

    await invalidate_tags(["resources", "examples"])
    return result.example_id


router = APIRouter()


@router.post(
    "/examples",
    response_model=ExamplesApiResponse,
    dependencies=[
        audit_activity(
            "examples.created",
            "{{ actor.name }} created examples",
        )
    ],
)
async def create_examples(
    request: ExamplesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ExamplesApiResponse:
    """Create examples resource (always INSERT)."""
    tags = ["resources", "examples"]

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
            # Convert API request to SQL params (use double star pattern)
            # Frontend sends snake_case (example) - auto-generated types match SQL function signature
            # Get mcp flag from header (set by router-level dependency)
            mcp = getattr(http_request.state, "mcp", False) or False

            # Convert API request to SQL params (use double star pattern)
            # Add mcp from header (not in request body)
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = ExamplesSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                ExamplesSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.example_id:
                raise ValueError("Failed to create examples")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                examples={"id": str(result.example_id)},
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = ExamplesApiResponse.model_validate(result.model_dump())

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
            operation="create_examples",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
