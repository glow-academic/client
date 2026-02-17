"""voices endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    VoicesApiRequest,
    VoicesApiResponse,
    VoicesSqlParams,
    VoicesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/resources/voices_complete.sql"


async def create_voices_internal(
    conn: asyncpg.Connection,
    voice: str,
    mcp: bool = False,
) -> UUID:
    """Create a voice resource and return its ID.

    Can be called directly from other routes (e.g. duplicate endpoints)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = VoicesSqlParams(voice=voice, mcp=mcp)
    result = cast(
        VoicesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    if not result or not result.voices_id:
        raise ValueError(f"Failed to create voice: {voice}")

    await invalidate_tags(["resources", "voices"])
    return result.voices_id


router = APIRouter()


@router.post(
    "/voices",
    response_model=VoicesApiResponse,
    dependencies=[
        audit_activity(
            "voices.created",
            "{{ actor.name }} created voices",
        )
    ],
)
async def create_voices(
    request: VoicesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> VoicesApiResponse:
    """Create voices resource (always INSERT)."""
    tags = ["resources", "voices"]

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
            # Frontend sends snake_case (voices) - auto-generated types match SQL function signature
            # Add mcp from header (not in request body)
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = VoicesSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                VoicesSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.voices_id:
                raise ValueError("Failed to create voices")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                voices={"id": str(result.voices_id)},
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = VoicesApiResponse.model_validate(result.model_dump())

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
            operation="create_voices",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
