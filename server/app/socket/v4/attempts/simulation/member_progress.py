"""Handler for member_progress WebSocket event - handles user message upserts."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (
    GetMessageCreatedAtSqlParams,
    GetMessageCreatedAtSqlRow,
    MemberProgressUpsertSqlParams,
    MemberProgressUpsertSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class MemberProgressPayload(BaseModel):
    """Request to upsert user message and run."""

    chat_id: str
    message: str
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
            # Upsert user message and run via SQL
            SQL_PATH_UPSERT = "app/sql/v4/member/member_progress_upsert_complete.sql"
            try:
                import asyncpg  # type: ignore

                params = MemberProgressUpsertSqlParams(
                    chat_id=chat_id_uuid,
                    message_content=message_str,
                    audio=data.voice_mode,  # Maps to audio column in DB
                    upload_id=uuid.UUID(data.upload_id) if data.upload_id else None,
                )
                result = cast(
                    MemberProgressUpsertSqlRow,
                    await execute_sql_typed(conn, SQL_PATH_UPSERT, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await member_progress_error(
                        MemberProgressErrorPayload(
                            success=False,
                            message=user_msg,
                        ),
                        room=sid,
                    )
                    return
                await member_progress_error(
                    MemberProgressErrorPayload(
                        success=False,
                        message=f"Failed to process message: {str(e)}",
                    ),
                    room=sid,
                )
                return

            if not result:
                await member_progress_error(
                    MemberProgressErrorPayload(
                        success=False,
                        message="Failed to upsert user message/run",
                    ),
                    room=sid,
                )
                return

            message_id = result.message_id
            run_id = result.run_id
            audio = result.audio  # audio column indicates voice mode
            group_id = result.group_id

            # Get created_at for message_sent event
            SQL_PATH_CREATED_AT = (
                "app/sql/v4/messages/get_message_created_at_complete.sql"
            )
            created_at_params = GetMessageCreatedAtSqlParams(
                message_id=uuid.UUID(message_id)
            )
            created_at_result = cast(
                GetMessageCreatedAtSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_CREATED_AT, params=created_at_params
                ),
            )
            created_at = created_at_result.created_at if created_at_result else None

            # Emit message_sent event for tour progression and cross-component communication
            await sio.emit(
                "simulations_text_message_sent",
                MessageSentPayload(
                    message_id=message_id,
                    chat_id=str(chat_id_uuid),
                    message=message_str,
                    created_at=created_at.isoformat() if created_at else "",
                ).model_dump(),
                room=f"simulation_{chat_id_uuid}",
            )
            await sio.emit(
                "simulations_text_new_message",
                {
                    "message_id": message_id,
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

            # Route through artifacts system instead of old handlers
            # Get agent_id from chat context (SQL will determine text vs voice agent)
            # Use simulation context SQL to get the appropriate agent_id
            from app.sql.types import (
                GetSimulationRunContextSqlParams,
                GetSimulationRunContextSqlRow,
            )

            context_params = GetSimulationRunContextSqlParams(chat_id=chat_id_uuid)
            context_result = cast(
                GetSimulationRunContextSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/simulations/get_simulation_run_context_complete.sql",
                    params=context_params,
                ),
            )

            if not context_result or not context_result.agent_id:
                await member_progress_error(
                    MemberProgressErrorPayload(
                        success=False,
                        message="Failed to get simulation agent context",
                    ),
                    room=sid,
                )
                return

            # Determine agent_id and resource_type based on audio mode
            # For voice mode, use voice_agent_id and resource_type "voice" (audio adapter)
            # For text mode, use agent_id and resource_type "simulation" (text adapter)
            if audio:
                agent_id = (
                    context_result.voice_agent_id
                    if context_result.voice_agent_id
                    else context_result.agent_id
                )
                resource_type = "voice"  # Maps to audio adapter in HANDLER_MAPPING
            else:
                agent_id = context_result.agent_id
                resource_type = "simulation"  # Maps to text adapter in HANDLER_MAPPING

            # Route through artifacts system
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "agent_id": agent_id,
                    "resource_id": str(chat_id_uuid),
                    "resource_type": resource_type,
                    "group_id": str(group_id) if group_id else None,
                    "user_instructions": None,
                    "message_ids": [message_id],
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
