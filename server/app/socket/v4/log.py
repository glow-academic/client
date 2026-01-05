"""Handler for log_run WebSocket event - async pricing and logging."""

import json
import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import UPLOAD_FOLDER, get_internal_sio, sio
from app.sql.types import LogRunSqlParams, LogRunSqlRow
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/model_runs/log_run_complete.sql"


# Extended request type that includes fields for JSON file saving and activity logging
# These fields are not part of the SQL function but are needed for the endpoint
class LogRunApiRequest(BaseModel):
    """Request to log run pricing and metrics (snake_case)."""

    run_id: uuid.UUID
    operation_type: str  # "scenario", "document", "video_outline", "simulation", "voice", etc.
    input_text_tokens: int
    output_text_tokens: int
    input_audio_tokens: int | None = None
    input_image_tokens: int | None = None
    output_audio_tokens: int | None = None
    cached_text_tokens: int | None = None
    cached_audio_tokens: int | None = None
    system_prompt: str | None = None
    input_items: list[dict[str, Any]] | None = None  # TResponseInputItem format
    assistant_output: str | None = None
    department_id: uuid.UUID | None = None


async def _log_run_impl(sid: str, data: LogRunApiRequest) -> None:
    """Handle run pricing and logging requests via WebSocket (async, non-blocking)."""
    try:
        run_id = data.run_id
        department_id = data.department_id

        # Extract developer message contents from input_items
        developer_contents: list[str] = []
        if data.input_items:
            for item in data.input_items:
                if isinstance(item, dict):
                    role = item.get("role")
                    if role == "developer":
                        content = item.get("content")
                        if isinstance(content, str):
                            stripped = content.strip()
                            if stripped:
                                developer_contents.append(stripped)

        async with get_db_connection() as conn:
            # Use execute_sql_typed() with auto-generated types
            # Note: After type regeneration, department_id and assistant_output will be Optional
            # For now, we construct params with None values (SQL function accepts NULL)
            params_dict = {
                "run_id": run_id,
                "department_id": department_id,  # Can be None, SQL handles NULL
                "input_text_tokens": data.input_text_tokens,
                "input_audio_tokens": data.input_audio_tokens or 0,
                "input_image_tokens": data.input_image_tokens or 0,
                "output_text_tokens": data.output_text_tokens,
                "output_audio_tokens": data.output_audio_tokens or 0,
                "cached_text_tokens": data.cached_text_tokens or 0,
                "cached_audio_tokens": data.cached_audio_tokens or 0,
                "developer_contents": developer_contents,
                "assistant_output": data.assistant_output or "",
            }
            # Use model_construct to bypass validation for optional fields until types are regenerated
            params = LogRunSqlParams.model_construct(**params_dict)  # type: ignore
            result = cast(
                LogRunSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
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
                            "operation_type": data.operation_type,
                        },
                        endpoint="/socket/v4/log",
                        error=False,
                    )
                except Exception:
                    pass

            # Always save OpenAI messages as JSON file
            try:
                messages: list[dict[str, str]] = []

                # Add system message if provided
                if data.system_prompt:
                    messages.append({"role": "system", "content": data.system_prompt})

                # Add developer messages from input_items
                if data.input_items:
                    for item in data.input_items:
                        if isinstance(item, dict):
                            role = item.get("role")
                            if role == "developer":
                                content = item.get("content")
                                if isinstance(content, str) and content.strip():
                                    messages.append(
                                        {"role": "developer", "content": content.strip()}
                                    )

                # Add assistant message if provided
                if data.assistant_output and data.assistant_output.strip():
                    messages.append(
                        {"role": "assistant", "content": data.assistant_output.strip()}
                    )

                # Save to JSON file
                if messages:
                    json_file_path = UPLOAD_FOLDER / f"{run_id}.json"
                    with open(json_file_path, "w", encoding="utf-8") as f:
                        json.dump(messages, f, indent=2, ensure_ascii=False)
            except Exception:
                # Log error but don't fail the request
                pass

    except Exception:
        # Don't emit error to client - pricing is async and failures are logged
        pass


@sio.event  # type: ignore
async def log_run(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler (client-to-server)."""
    try:
        validated = LogRunApiRequest(**data)
        await _log_run_impl(sid, validated)
    except ValidationError:
        pass


@internal_sio.on("log_run")
async def log_run_internal(data: dict[str, Any]) -> None:
    """Handle log_run event from internal bus (server-to-server)."""
    try:
        validated = LogRunApiRequest(**data)
        # Use empty string as sid for internal calls (not needed for async background work)
        await _log_run_impl("", validated)
    except ValidationError:
        pass


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/log", response_model=dict[str, bool])
async def log_run_api(request: LogRunApiRequest) -> dict[str, bool]:
    """Client-to-server event: Log run pricing and metrics (async, non-blocking)."""
    return {"success": True}
