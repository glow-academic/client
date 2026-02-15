"""Create attempt endpoint - creates attempt only (no chat).

Used by the lobby flow: SimulationCard creates attempt via REST,
then the lobby starts chat via WS training_start with attempt_id.
"""

import uuid as uuid_mod
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.sql.types import (
    CreateAttemptChatSqlParams,
    CreateAttemptChatSqlRow,
    CreateAttemptSqlParams,
    CreateAttemptSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/sql/v4/queries/artifacts/attempt/create_attempt_complete.sql"
SQL_PATH_CREATE_CHAT = (
    "app/sql/v4/queries/generate/attempt/create_attempt_chat_complete.sql"
)

router = APIRouter()


async def create_chat_internal(
    conn: asyncpg.Connection,
    profile_id: uuid_mod.UUID,
    attempt_id: uuid_mod.UUID,
    training_bundle_department_id: uuid_mod.UUID,
) -> uuid_mod.UUID | None:
    """Create an attempt chat + config snapshots and refresh MVs.

    Returns the chat_id on success, None on failure.
    """
    try:
        chat_params = CreateAttemptChatSqlParams(
            p_profile_id=profile_id,
            p_attempt_id=attempt_id,
            p_training_bundle_department_id=training_bundle_department_id,
        )

        chat_row = cast(
            CreateAttemptChatSqlRow,
            await execute_sql_typed(conn, SQL_PATH_CREATE_CHAT, params=chat_params),
        )

        if not chat_row or not chat_row.chat_id:
            return None

        # Refresh MVs so attempt is immediately visible
        await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
        await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

        await invalidate_tags(["attempt", "attempts"])
        return chat_row.chat_id

    except Exception as e:
        logger.exception(f"create_chat_internal failed: {e}")
        return None


class CreateAttemptRequest(BaseModel):
    training_bundle_entry_id: UUID
    infinite_mode: bool = False


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
            p_infinite_mode=request.infinite_mode,
        )

        row = cast(
            CreateAttemptSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not row or not row.out_attempt_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to create attempt.",
            )

        # Invalidate caches so the new attempt is visible
        await invalidate_tags(["attempt", "attempts"])

        return CreateAttemptResponse(attempt_id=row.out_attempt_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create attempt: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create attempt: {str(e)}",
        ) from e
