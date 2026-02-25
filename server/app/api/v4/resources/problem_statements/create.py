"""problem_statements endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    ProblemStatementsApiRequest,
    ProblemStatementsApiResponse,
    ProblemStatementsSqlParams,
    ProblemStatementsSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/resources/problem_statements_complete.sql"


async def create_problem_statements_internal(
    conn: asyncpg.Connection,
    problem_statement: str,
    name: str | None = None,
    mcp: bool = False,
) -> UUID:
    """Create a problem_statement resource and return its ID.

    Can be called directly from other routes (e.g. scenario save)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = ProblemStatementsSqlParams(
        name=name or problem_statement[:100],
        problem_statement=problem_statement,
        mcp=mcp,
    )
    result = cast(
        ProblemStatementsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    if not result or not result.problem_statement_id:
        raise ValueError(
            f"Failed to create problem_statement: {problem_statement[:50]}"
        )

    await invalidate_tags(["resources", "problem_statements"])
    return result.problem_statement_id


router = APIRouter()


@router.post(
    "/problem_statements",
    response_model=ProblemStatementsApiResponse,
    dependencies=[
        audit_activity(
            "problem_statements.created",
            "{{ actor.name }} created problem_statements",
        )
    ],
)
async def create_problem_statements(
    request: ProblemStatementsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProblemStatementsApiResponse:
    """Create problem_statements resource (always INSERT)."""
    tags = ["resources", "problem_statements"]

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
            # Frontend sends snake_case (name, problem_statement) - auto-generated types match SQL function signature
            # Get mcp flag from header (set by router-level dependency)
            mcp = getattr(http_request.state, "mcp", False) or False

            # Convert API request to SQL params (use double star pattern)
            # Add mcp from header (not in request body)
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = ProblemStatementsSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                ProblemStatementsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.problem_statement_id:
                raise ValueError("Failed to create problem_statements")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                problem_statements={"id": str(result.problem_statement_id)},
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = ProblemStatementsApiResponse.model_validate(result.model_dump())

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
            operation="create_problem_statements",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
