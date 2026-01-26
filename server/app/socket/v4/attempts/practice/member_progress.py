"""Handler for member_progress WebSocket event - handles user message upserts."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetSimulationRunContextSqlParams,
    GetSimulationRunContextSqlRow,
)
from app.utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class MemberProgressPayload(BaseModel):
    """Request to upsert user message and run."""

    chat_id: str
    message: str
    group_id: str | None = None
    voice_mode: bool = False
    upload_id: str | None = None  # For voice audio uploads


class MemberProgressErrorPayload(BaseModel):
    """Response indicating an error occurred in member progress."""

    success: bool
    message: str


class MessageSentPayload(BaseModel):
    """Response indicating user message sent successfully."""

    message_id: str
    chat_id: str
    message: str
    created_at: str


# Emit helper functions
async def member_progress_error(payload: MemberProgressErrorPayload, room: str) -> None:
    await sio.emit("member_progress_error", payload.model_dump(), room=room)


async def _member_progress_impl(
    sid: str, data: MemberProgressPayload, profile_id: uuid.UUID
) -> None:
    """Handle member_progress event - upserts user message/run, triggers generate via artifacts system."""
    try:
        chat_id = data.chat_id
        if not chat_id:
            await member_progress_error(
                MemberProgressErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        message_str = data.message
        if not message_str or not message_str.strip():
            await member_progress_error(
                MemberProgressErrorPayload(
                    success=False, message="Missing or empty message"
                ),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)

        async with get_db_connection() as conn:
            # Determine chat type (general vs practice)
            is_general_sql = load_sql(
                "app/sql/v4/queries/attempts/general/is_general_chat_complete.sql"
            )
            is_general_row = await conn.fetchrow(is_general_sql, chat_id_uuid)
            is_general = bool(is_general_row["is_general"]) if is_general_row else False
            if is_general:
                sql_path = (
                    "app/sql/v4/queries/attempts/general/member_progress_start_complete.sql"
                )
            else:
                sql_path = (
                    "app/sql/v4/queries/attempts/practice/member_progress_start_complete.sql"
                )

            sql = load_sql(sql_path)
            row = await conn.fetchrow(
                sql,
                chat_id_uuid,
                uuid.UUID(data.group_id) if data.group_id else None,
                message_str,
                data.voice_mode,
                uuid.UUID(data.upload_id) if data.upload_id else None,
            )
            if not row:
                await member_progress_error(
                    MemberProgressErrorPayload(
                        success=False,
                        message="Failed to create message/run",
                    ),
                    room=sid,
                )
                return

            user_message_id = str(row["user_message_id"])
            assistant_message_id = str(row["assistant_message_id"])
            run_id = str(row["run_id"])
            group_id = str(row["group_id"]) if row.get("group_id") else None
            created_at = row.get("created_at")
            audio = data.voice_mode

            # Emit message_sent event for tour progression and cross-component communication
            await sio.emit(
                "simulation_text_message_sent",
                MessageSentPayload(
                    message_id=user_message_id,
                    chat_id=str(chat_id_uuid),
                    message=message_str,
                    created_at=created_at.isoformat() if created_at else "",
                ).model_dump(),
                room=f"simulation_{chat_id_uuid}",
            )
            await sio.emit(
                "simulation_text_new_message",
                {
                    "message_id": user_message_id,
                    "chat_id": str(chat_id_uuid),
                    "role": "user",
                    "content": message_str,
                    "completed": True,
                    "created_at": created_at.isoformat() if created_at else "",
                },
                room=f"simulation_{chat_id_uuid}",
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="member.progress.message_sent",
                    template="{{ actor.name }} sent message via member agent",
                    context={"chat_id": str(chat_id_uuid), "audio": audio},
                    endpoint="/socket/v4/simulations/member/progress",
                    error=False,
                )
            except Exception:
                pass

            # Get simulation context for model config + prompts
            context_params = GetSimulationRunContextSqlParams(chat_id=chat_id_uuid)
            context_result = cast(
                GetSimulationRunContextSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/simulations/get_simulation_run_context_complete.sql",
                    params=context_params,
                ),
            )

            if not context_result or not context_result.model_name:
                await member_progress_error(
                    MemberProgressErrorPayload(
                        success=False,
                        message="Failed to get simulation model context",
                    ),
                    room=sid,
                )
                return

            if audio:
                resource_type = "voice"
                model_name = context_result.voice_model_name or context_result.model_name
                api_key = context_result.voice_api_key or context_result.api_key
                base_url = context_result.voice_base_url or context_result.base_url
                temperature = (
                    context_result.voice_temperature
                    if context_result.voice_temperature is not None
                    else context_result.temperature
                )
                reasoning = context_result.voice_reasoning or context_result.reasoning
                provider = context_result.voice_provider or context_result.provider
                system_prompt = (
                    context_result.voice_system_prompt
                    or context_result.system_prompt
                    or ""
                )
            else:
                resource_type = "simulation"
                model_name = context_result.model_name
                api_key = context_result.api_key
                base_url = context_result.base_url
                temperature = context_result.temperature
                reasoning = context_result.reasoning
                provider = context_result.provider
                system_prompt = context_result.system_prompt or ""

            # Route through artifacts system
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "simulation",
                    "resource_type": resource_type,
                    "modality": "text",
                    "run_id": run_id,
                    "group_id": str(group_id) if group_id else None,
                    "chat_id": str(chat_id_uuid),
                    "message_id": assistant_message_id,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message_str},
                    ],
                    "llm_config": {
                        "model": model_name,
                        "api_key": api_key,
                        "base_url": base_url,
                        "temperature": temperature,
                        "reasoning": reasoning,
                        "provider": provider,
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                },
            )
    except ValueError as e:
        await member_progress_error(
            MemberProgressErrorPayload(
                success=False, message=f"Invalid UUID format: {str(e)}"
            ),
            room=sid,
        )
    except Exception as e:
        await member_progress_error(
            MemberProgressErrorPayload(success=False, message=str(e)),
            room=sid,
        )


@sio.event  # type: ignore
async def member_progress(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=MemberProgressPayload,
        handler=_member_progress_impl,
        error_event_name="member_progress_error",
        error_response_type=MemberProgressErrorPayload,
    )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/member/progress", response_model=dict[str, bool])
async def member_progress_api(request: MemberProgressPayload) -> dict[str, bool]:
    """Client-to-server event: Upsert user message and run."""
    return {"success": True}


@server_router.post("/member/progress_error", response_model=dict[str, bool])
async def member_progress_error_api(
    request: MemberProgressErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in member progress."""
    return {"success": True}


register_server_endpoint(
    client_router,
    "/member/progress",
    MemberProgressPayload,
    "Upsert user message and run, trigger appropriate generate event via artifacts system",
)
