"""Create test endpoint - creates benchmark test via REST.

Used by the EvalCard flow: creates test via REST instead of WebSocket,
then navigates to /benchmark/t/[testId].
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.sql.types import (
    CreateTestInvocationsSqlParams,
    CreateTestInvocationsSqlRow,
    CreateTestSqlParams,
    CreateTestSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/sql/v4/queries/artifacts/test/create_test_complete.sql"
SQL_PATH_CREATE_INVOCATIONS = (
    "app/sql/v4/queries/generate/test/create_test_invocations_complete.sql"
)

router = APIRouter()


async def create_invocations_internal(
    conn: asyncpg.Connection,
    test_id: UUID,
    eval_id: UUID,
) -> UUID | None:
    """Create test invocations + refresh MVs.

    Returns the first invocation_id on success, None on failure.
    """
    try:
        params = CreateTestInvocationsSqlParams(
            p_test_id=test_id,
            p_eval_id=eval_id,
        )

        row = cast(
            CreateTestInvocationsSqlRow,
            await execute_sql_typed(conn, SQL_PATH_CREATE_INVOCATIONS, params=params),
        )

        if not row or not row.chats:
            return None

        # Refresh MVs so invocations are immediately visible
        await conn.execute("REFRESH MATERIALIZED VIEW mv_benchmark_invocations")

        await invalidate_tags(["test", "tests", "benchmark", "invocations"])

        first_chat = row.chats[0] if row.chats else None
        if first_chat and isinstance(first_chat, dict):
            chat_id = first_chat.get("chat_id")
            return UUID(str(chat_id)) if chat_id else None
        return None

    except Exception as e:
        logger.exception(f"create_invocations_internal failed: {e}")
        return None


class CreateTestRequest(BaseModel):
    eval_id: UUID
    infinite_mode: bool = False


class CreateTestResponse(BaseModel):
    test_id: UUID


@router.post(
    "/create",
    response_model=CreateTestResponse,
)
async def create_test(
    request: CreateTestRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateTestResponse:
    """Create a new benchmark test via REST."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        params = CreateTestSqlParams(
            p_profile_id=profile_id,
            p_eval_id=request.eval_id,
            p_infinite_mode=request.infinite_mode,
        )

        row = cast(
            CreateTestSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not row or not row.test_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to create test.",
            )

        # Create invocations for the test
        await create_invocations_internal(conn, row.test_id, request.eval_id)

        # Invalidate caches so the new test is visible
        await invalidate_tags(["test", "tests", "benchmark"])

        return CreateTestResponse(test_id=row.test_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create test: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create test: {str(e)}",
        ) from e
