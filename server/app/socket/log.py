"""Handler for log_run WebSocket event - async pricing and logging."""

import uuid
from typing import Any

from agents.items import TResponseInputItem
from app.main import get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.messages.log_run_messages import log_run_messages
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic model for client-to-server event
class LogRunPayload(BaseModel):
    runId: str
    operationType: str  # "scenario", "document", "video_outline", "simulation", "voice", etc.
    inputTextTokens: int
    outputTextTokens: int
    inputAudioTokens: int | None = None
    inputImageTokens: int | None = None
    outputAudioTokens: int | None = None
    cachedTextTokens: int | None = None
    cachedAudioTokens: int | None = None
    systemPrompt: str | None = None
    inputItems: list[dict[str, Any]] | None = None  # TResponseInputItem serialized
    assistantOutput: str | None = None
    departmentId: str | None = None


async def _log_run_impl(sid: str, data: LogRunPayload) -> None:
    """Handle run pricing and logging requests via WebSocket (async, non-blocking)."""
    try:
        logger.info(
            f"Received log_run request from {sid} for run_id={data.runId}, operation={data.operationType}"
        )

        run_id = uuid.UUID(data.runId)
        department_id = uuid.UUID(data.departmentId) if data.departmentId else None

        # Get connection pool
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available for pricing")
            return

        async with pool.acquire() as conn:
            # Determine which SQL file to use based on token types
            has_audio_or_image = (
                data.inputAudioTokens is not None
                or data.inputImageTokens is not None
                or data.outputAudioTokens is not None
                or data.cachedAudioTokens is not None
            )

            if has_audio_or_image:
                # Use audio/text/image token SQL file
                sql_update_tokens = load_sql(
                    "sql/v3/model_runs/update_model_run_tokens_audio_text_image.sql"
                )
                await conn.execute(
                    sql_update_tokens,
                    str(run_id),
                    data.inputTextTokens,
                    data.inputAudioTokens or 0,
                    data.inputImageTokens or 0,
                    data.outputTextTokens,
                    data.outputAudioTokens or 0,
                    data.cachedTextTokens or 0,
                    data.cachedAudioTokens or 0,
                )
                logger.info(
                    f"Updated tokens (audio/image): input_text={data.inputTextTokens}, "
                    f"input_audio={data.inputAudioTokens or 0}, "
                    f"input_image={data.inputImageTokens or 0}, "
                    f"output_text={data.outputTextTokens}, "
                    f"output_audio={data.outputAudioTokens or 0}, "
                    f"cached_text={data.cachedTextTokens or 0}, "
                    f"cached_audio={data.cachedAudioTokens or 0}"
                )
            else:
                # Use text-only token SQL file
                sql_update_tokens = load_sql(
                    "sql/v3/model_runs/update_model_run_tokens.sql"
                )
                await conn.execute(
                    sql_update_tokens,
                    str(run_id),
                    data.inputTextTokens,
                    data.outputTextTokens,
                )
                logger.info(
                    f"Updated tokens (text-only): input={data.inputTextTokens}, "
                    f"output={data.outputTextTokens}"
                )

            # Log all messages in single transaction
            # Convert input_items back to TResponseInputItem format
            input_items: list[TResponseInputItem] | None = None
            if data.inputItems:
                input_items = data.inputItems  # type: ignore[assignment]

            await log_run_messages(
                conn=conn,
                run_id=run_id,
                system_prompt=data.systemPrompt,
                input_items=input_items,
                assistant_output=data.assistantOutput,
                department_id=department_id,
            )

            logger.info(
                f"✓ Completed pricing and logging for run_id={run_id}, "
                f"operation={data.operationType}, "
                f"tokens={data.inputTextTokens}+{data.outputTextTokens}"
            )

    except Exception as e:
        logger.error(
            f"Error in log_run for {sid}, run_id={data.runId}: {str(e)}",
            exc_info=True,
        )
        # Don't emit error to client - pricing is async and failures are logged


@sio.event  # type: ignore
async def log_run(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = LogRunPayload(**data)
        await _log_run_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in log_run for {sid}: {e}")

