"""Create attempt endpoint - creates attempt only (no chat).

Used by the lobby flow: SimulationCard creates attempt via REST,
then the lobby starts chat via WS training_start with attempt_id.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.sql.types import (
    CreateAttemptSqlParams,
    CreateAttemptSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/sql/v4/queries/artifacts/attempt/create_attempt_complete.sql"

router = APIRouter()


class CreateAttemptRequest(BaseModel):
    training_bundle_entry_id: UUID


class CreateAttemptResponse(BaseModel):
    attempt_id: UUID


@router.post(
    "/create",
    response_model=CreateAttemptResponse,
)
async def create_attempt(
    request: CreateAttemptRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAttemptResponse:
    """Create a new training attempt (no chat - lobby will start chat later)."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        params = CreateAttemptSqlParams(
            p_profile_id=profile_id,
            p_training_bundle_entry_id=request.training_bundle_entry_id,
        )

        row = cast(
            CreateAttemptSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not row or not row.attempt_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to create attempt.",
            )

        # Invalidate caches so the new attempt is visible
        await invalidate_tags(["attempt", "attempts"])

        return CreateAttemptResponse(attempt_id=row.attempt_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create attempt: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create attempt: {str(e)}",
        ) from e
