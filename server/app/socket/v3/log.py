"""Handler for log_run WebSocket event - async pricing and logging."""

import json
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import UPLOAD_FOLDER, get_internal_sio, get_pool, sio
from app.infra.activity.websocket_logger import log_websocket_activity
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class ResponseInputItem(BaseModel):
    """Input item for agent conversation (TResponseInputItem format)."""

    role: str  # "user" | "developer" | "assistant" | etc.
    content: (
        str | list[dict[str, Any]]
    )  # Content can be string or list of content items


class LogRunPayload(BaseModel):
    """Request to log run pricing and metrics."""

    runId: str
    operationType: (
        str  # "scenario", "document", "video_outline", "simulation", "voice", etc.
    )
    inputTextTokens: int
    outputTextTokens: int
    inputAudioTokens: int | None = None
    inputImageTokens: int | None = None
    outputAudioTokens: int | None = None
    cachedTextTokens: int | None = None
    cachedAudioTokens: int | None = None
    systemPrompt: str | None = None
    inputItems: list[ResponseInputItem] | None = None
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

        # Extract developer message contents from inputItems
        developer_contents: list[str] = []
        if data.inputItems:
            for item in data.inputItems:
                if item and item.role == "developer":
                    content = item.content
                    if isinstance(content, str):
                        stripped = content.strip()
                        if stripped:
                            developer_contents.append(stripped)

        # Get connection pool
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available for pricing")
            return

        async with pool.acquire() as conn:
            # Use consolidated SQL file that handles everything in one transaction
            sql_log_run = load_sql("sql/v3/model_runs/log_run_complete.sql")
            await conn.execute(
                sql_log_run,
                str(run_id),
                str(department_id) if department_id else None,
                data.inputTextTokens,
                data.inputAudioTokens or 0,
                data.inputImageTokens or 0,
                data.outputTextTokens,
                data.outputAudioTokens or 0,
                data.cachedTextTokens or 0,
                data.cachedAudioTokens or 0,
                developer_contents if developer_contents else None,
                data.assistantOutput,
            )

            logger.info(
                f"✓ Completed pricing and logging for run_id={run_id}, "
                f"operation={data.operationType}, "
                f"tokens={data.inputTextTokens}+{data.outputTextTokens}"
            )
            # Log activity (only for client-to-server events, not internal)
            if sid and sid != "" and sid != "internal":
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="websocket.log",
                        template="{{ actor.name }} logged run",
                        context={
                            "run_id": str(run_id),
                            "operation_type": data.operationType,
                        },
                        endpoint="/socket/v3/log",
                        error=False,
                    )
                except Exception as log_error:
                    logger.warning(f"Error logging websocket log activity: {log_error}")

            # Always save OpenAI messages as JSON file
            try:
                messages: list[dict[str, str]] = []

                # Add system message if provided
                if data.systemPrompt:
                    messages.append({"role": "system", "content": data.systemPrompt})

                # Add developer messages from inputItems
                if data.inputItems:
                    for item in data.inputItems:
                        if item and item.role == "developer":
                            content = item.content
                            if isinstance(content, str) and content.strip():
                                messages.append(
                                    {"role": "developer", "content": content.strip()}
                                )

                # Add assistant message if provided
                if data.assistantOutput and data.assistantOutput.strip():
                    messages.append(
                        {"role": "assistant", "content": data.assistantOutput.strip()}
                    )

                # Save to JSON file
                if messages:
                    json_file_path = UPLOAD_FOLDER / f"{run_id}.json"
                    with open(json_file_path, "w", encoding="utf-8") as f:
                        json.dump(messages, f, indent=2, ensure_ascii=False)
                    logger.info(
                        f"Saved OpenAI messages to {json_file_path} ({len(messages)} messages)"
                    )
            except Exception as json_error:
                # Log error but don't fail the request
                logger.error(
                    f"Failed to save JSON file for run_id={run_id}: {str(json_error)}",
                    exc_info=True,
                )

    except Exception as e:
        logger.error(
            f"Error in log_run for {sid}, run_id={data.runId}: {str(e)}",
            exc_info=True,
        )
        # Don't emit error to client - pricing is async and failures are logged


@sio.event  # type: ignore
async def log_run(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler (client-to-server)."""
    try:
        validated = LogRunPayload(**data)
        await _log_run_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in log_run for {sid}: {e}")


@internal_sio.on("log_run")
async def log_run_internal(data: dict[str, Any]) -> None:
    """Handle log_run event from internal bus (server-to-server)."""
    try:
        validated = LogRunPayload(**data)
        # Use empty string as sid for internal calls (not needed for async background work)
        await _log_run_impl("", validated)
    except ValidationError as e:
        logger.error(f"Validation error in log_run_internal: {e}")


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/log", response_model=dict[str, bool])
async def log_run_api(request: LogRunPayload) -> dict[str, bool]:
    """Client-to-server event: Log run pricing and metrics (async, non-blocking)."""
    return {"success": True}
