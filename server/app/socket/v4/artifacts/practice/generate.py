"""Practice generation handler - creates attempt synchronously, then delegates to chat_generate.

Flow:
1. Validate profile via find_profile_by_socket(sid)
2. Resolve training context (cached) via get_training_attempt_context_internal
3. Create attempt via create_attempt_with_context_internal
4. Emit practice_generation_started
5. GET from attempt_mv for training_entry_id + training_department_id
6. Emit chat_generate on internal bus with context
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.entries.attempt.create import create_attempt_with_context_internal
from app.api.v4.entries.attempt.get import get_attempt_entries_internal
from app.api.v4.resources.training.context import get_training_attempt_context_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.practice.types import (
    GeneratePracticePayload,
    PracticeGenerationErrorEvent,
    PracticeGenerationStartedEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


async def _practice_generate_impl(
    sid: str,
    payload: GeneratePracticePayload,
    profile_id: uuid.UUID,
) -> None:
    """Handle practice generation - create attempt, then delegate to chat_generate."""
    try:
        # Step 1: Resolve training context (cached)
        async with get_db_connection() as conn:
            ctx = await get_training_attempt_context_internal(
                conn, profile_id, payload.training_entry_id
            )

        # Step 2: Create attempt with pre-resolved context
        async with get_db_connection() as conn:
            attempt_id = await create_attempt_with_context_internal(
                conn, context=ctx, infinite_mode=payload.infinite_mode
            )

        # Step 3: Emit practice_generation_started to client
        event = PracticeGenerationStartedEvent(
            attempt_id=str(attempt_id),
            training_entry_id=str(payload.training_entry_id),
        )
        await sio.emit(
            "practice_generation_started",
            event.model_dump(mode="json"),
            room=sid,
        )

        # Step 4: GET from MV (cached) — replaces SQL_ATTEMPT_CONTEXT
        async with get_db_connection() as conn:
            items = await get_attempt_entries_internal(
                conn, [attempt_id], bypass_cache=True
            )

        if not items:
            logger.warning(f"No attempt data in MV for attempt {attempt_id}")
            return

        attempt_data = items[0]

        if not attempt_data.get("training_entry_id") or not attempt_data.get(
            "training_department_id"
        ):
            logger.warning(f"No training context in MV for attempt {attempt_id}")
            return

        # Step 5: Delegate to chat_generate on internal bus
        resource_types = payload.resource_types or [
            "personas",
            "scenarios",
            "parameters",
            "fields",
        ]

        emit_data: dict[str, Any] = {
            "sid": sid,
            "training_entry_id": str(attempt_data["training_entry_id"]),
            "resource_types": resource_types,
            "save": payload.save,
            "attempt_id": str(attempt_id),
            "training_department_id": str(attempt_data["training_department_id"]),
        }

        if payload.draft_id:
            emit_data["draft_id"] = str(payload.draft_id)
        if payload.user_instructions:
            emit_data["user_instructions"] = payload.user_instructions

        await internal_sio.emit("chat_generate", emit_data)

    except Exception as e:
        logger.exception(f"Error in practice_generate: {str(e)}")
        await sio.emit(
            "practice_generation_error",
            PracticeGenerationErrorEvent(
                message=f"Failed to start practice generation: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def practice_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle practice_generate event from client."""
    try:
        payload = GeneratePracticePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "practice_generation_error",
                PracticeGenerationErrorEvent(
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _practice_generate_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in practice_generate: {str(e)}")
        await sio.emit(
            "practice_generation_error",
            PracticeGenerationErrorEvent(
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("practice_generate")  # type: ignore
async def practice_generate_internal(data: dict[str, Any]) -> None:
    """Handle practice_generate from internal bus."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GeneratePracticePayload(**data)
        await _practice_generate_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Error in practice_generate_internal: {str(e)}")


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/practice/generate", response_model=dict[str, bool])
async def practice_generate_api(request: GeneratePracticePayload) -> dict[str, bool]:
    """Client-to-server event: Start practice generation."""
    return {"success": True}


@server_router.post("/practice_generation_started")
async def practice_generation_started_api(
    request: PracticeGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Practice generation started."""
    return {"success": True}
