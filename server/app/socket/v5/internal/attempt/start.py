"""Internal attempt_start handler — creates a new attempt, then delegates to attempt_proceed.

Handles: @internal_sio.on("attempt_start")

Flow:
1. Call socket_start_attempt_v4 (creates attempt_entry + parent bridge + profile link)
2. Emit attempt_proceed with attempt_id
"""

from __future__ import annotations

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptStartPayload
from app.socket.v5.internal.attempt.types import (
    AttemptErrorData,
    AttemptProceedData,
)
from app.sql.types import StartAttemptSqlParams, StartAttemptSqlRow
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_START_ATTEMPT = (
    "app/sql/v4/queries/generate/attempt/start_attempt_complete.sql"
)


@internal_sio.on("attempt_start")  # type: ignore
async def attempt_start_handler(data: dict[str, Any]) -> None:
    """Handle attempt_start — create a new attempt, then emit attempt_proceed."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptStartPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_start payload: {e}")
        return

    try:
        # Step 1: Create attempt via SQL function
        async with get_db_connection() as conn:
            row = cast(
                StartAttemptSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_START_ATTEMPT,
                    params=StartAttemptSqlParams(
                        p_profile_id=profile_id,
                        p_home_id=payload.home_id,
                        p_practice_id=payload.practice_id,
                        p_infinite_mode=payload.infinite_mode,
                    ),
                ),
            )

        if not row or not row.items:
            raise ValueError("Failed to create attempt")

        attempt_id = row.items[0].attempt_id

        # Step 2: Refresh MVs so the attempt is visible immediately
        async with get_db_connection() as conn:
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_chat_mv")
        await invalidate_tags(["attempt", "attempts"])

        # Step 3: Delegate to attempt_proceed
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                attempt_id=str(attempt_id),
                force_proceed=False,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_start: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="start",
                message=f"Failed to start attempt: {e}",
            ).model_dump(mode="json"),
        )
