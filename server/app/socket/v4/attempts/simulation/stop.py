"""Handler for simulation stop WebSocket events (text and voice)."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from app.utils.sql_helper import load_sql

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.cancel_active_run import cancel_active_run
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import (
    _voice_message_ids,
    _voice_message_ids_lock,
    _voice_sessions,
    sio,
)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class StopSimulationErrorPayload(BaseModel):
    """Response indicating an error occurred while stopping simulation."""

    success: bool
    message: str


class SimulationMessageCancelledPayload(BaseModel):
    """Response indicating a simulation message was cancelled."""

    message_id: str
    chat_id: str
    final_content: str


class SimulationStoppedPayload(BaseModel):
    """Response indicating simulation was stopped successfully."""

    chat_id: str
    success: bool
    message: str


# Pydantic models for client-to-server events
class StopSimulationPayload(BaseModel):
    """Request to stop an active simulation run."""

    chat_id: str


class StopVoicePayload(BaseModel):
    """Request to stop a voice simulation session."""

    chat_id: str


class StopVoiceErrorPayload(BaseModel):
    """Response indicating an error occurred while stopping voice simulation."""

    success: bool
    message: str


class StopVoiceResponsePayload(BaseModel):
    """Response from stopping a voice simulation session."""

    success: bool
    message: str


# Emit helper functions
async def simulation_text_stop_error(
    payload: StopSimulationErrorPayload, room: str
) -> None:
    await sio.emit("simulation_text_stop_error", payload.model_dump(), room=room)


async def simulation_message_cancelled(
    payload: SimulationMessageCancelledPayload, room: str
) -> None:
    await sio.emit(
        "simulation_text_message_cancelled", payload.model_dump(), room=room
    )


async def simulation_stopped(payload: SimulationStoppedPayload, room: str) -> None:
    await sio.emit("simulation_text_stopped", payload.model_dump(), room=room)


async def simulation_voice_stop_error(
    payload: StopVoiceErrorPayload, room: str
) -> None:
    await sio.emit("simulation_voice_stop_error", payload.model_dump(), room=room)


async def simulation_voice_stop_response(
    payload: StopVoiceResponsePayload, room: str
) -> None:
    await sio.emit("simulation_voice_stop_response", payload.model_dump(), room=room)


async def _simulation_text_stop_impl(sid: str, data: StopSimulationPayload) -> None:
    """
    Handle simulation stop requests via WebSocket
    Replaces /simulations/stop endpoint
    """
    try:
        chat_id = data.chat_id

        if not chat_id:
            await simulation_text_stop_error(
                StopSimulationErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            # Attempt to cancel the simulation run and the in-process Runner immediately
            from app.infra.v4.websocket.cancel_active_result import cancel_active_result

            # Try immediate in-process cancel first
            await cancel_active_result(str(chat_id))
            # Then set cooperative cancel flag (Redis) - inlined cancel_simulation_run
            await cancel_active_run(str(chat_id))

            # Stop simulation and mark message complete using SQL
            sql = load_sql(
                "app/sql/v4/simulations/simulation_text_stop_run_complete.sql"
            )
            row = await conn.fetchrow(sql, chat_id)

            if not row:
                result = {
                    "success": False,
                    "cancelled_message_id": None,
                    "final_content": "",
                }
            else:
                result = {
                    "success": row["success"],
                    "cancelled_message_id": row["cancelled_message_id"],
                    "final_content": row["final_content"],
                }

            if result["success"] and result["cancelled_message_id"]:
                # Emit a cancellation / final content event so clients update UI
                await simulation_message_cancelled(
                    SimulationMessageCancelledPayload(
                        message_id=str(result["cancelled_message_id"]),
                        chat_id=str(chat_id),
                        final_content=str(result["final_content"])
                        if result["final_content"]
                        else "",
                    ),
                    room=f"simulation_{chat_id}",
                )

                # Emit stop signal
                await simulation_stopped(
                    SimulationStoppedPayload(
                        chat_id=chat_id,
                        success=True,
                        message="",  # Empty message, no toast
                    ),
                    room=f"simulation_{chat_id}",
                )
                # Log activity
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="simulations.text.stopped",
                        template="{{ actor.name }} stopped simulation",
                        context={"chat_id": str(chat_id)},
                        endpoint="/socket/v4/simulations/text/stop",
                        error=False,
                    )
                except Exception:
                    pass
            else:
                await simulation_stopped(
                    SimulationStoppedPayload(
                        chat_id=chat_id,
                        success=False,
                        message="No active message found for this chat",
                    ),
                    room=f"simulation_{chat_id}",
                )

    except Exception as e:
        await simulation_text_stop_error(
            StopSimulationErrorPayload(
                success=False, message=f"Failed to stop simulation: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.stopped",
                template="{{ actor.name }} failed to stop simulation",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/text/stop",
                error=True,
            )
        except Exception:
            pass


@sio.event  # type: ignore
async def simulation_text_stop(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = StopSimulationPayload(**data)
        await _simulation_text_stop_impl(sid, validated)
    except ValidationError as e:
        await simulation_text_stop_error(
            StopSimulationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.stopped",
                template="{{ actor.name }} failed to stop simulation (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/text/stop",
                error=True,
            )
        except Exception:
            pass


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/stop", response_model=dict[str, bool])
async def simulation_text_stop_api(request: StopSimulationPayload) -> dict[str, bool]:
    """Client-to-server event: Stop an active simulation run."""
    return {"success": True}


@server_router.post("/stopped", response_model=dict[str, bool])
async def simulation_stopped_api(request: SimulationStoppedPayload) -> dict[str, bool]:
    """Server-to-client event: Simulation stopped successfully."""
    return {"success": True}


@server_router.post("/message_cancelled", response_model=dict[str, bool])
async def simulation_message_cancelled_api(
    request: SimulationMessageCancelledPayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation message was cancelled."""
    return {"success": True}


@server_router.post("/stop_error", response_model=dict[str, bool])
async def simulation_text_stop_error_api(
    request: StopSimulationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while stopping simulation."""
    return {"success": True}


async def _simulation_voice_stop_impl(sid: str, data: StopVoicePayload) -> None:
    """Handle voice session stop requests via WebSocket."""
    try:
        chat_id = data.chat_id
        if not chat_id:
            await simulation_voice_stop_error(
                StopVoiceErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        # Remove voice session
        if chat_id in _voice_sessions:
            del _voice_sessions[chat_id]
        else:
            pass
        # Clear accumulated message IDs to prevent stale data
        async with _voice_message_ids_lock:
            if chat_id in _voice_message_ids:
                del _voice_message_ids[chat_id]
        await simulation_voice_stop_response(
            StopVoiceResponsePayload(
                success=True, message="Voice session stopped successfully"
            ),
            room=sid,
        )
        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.voice.stopped",
                template="{{ actor.name }} stopped voice simulation",
                context={"chat_id": chat_id},
                endpoint="/socket/v4/simulations/stop",
                error=False,
            )
        except Exception:
            pass
    except Exception as e:
        await simulation_voice_stop_error(
            StopVoiceErrorPayload(success=False, message=str(e)), room=sid
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.voice.stopped",
                template="{{ actor.name }} failed to stop voice simulation",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/stop",
                error=True,
            )
        except Exception:
            pass


@sio.event  # type: ignore
async def simulation_voice_stop(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = StopVoicePayload(**data)
        await _simulation_voice_stop_impl(sid, validated)
    except ValidationError as e:
        await simulation_voice_stop_error(
            StopVoiceErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.voice.stopped",
                template="{{ actor.name }} failed to stop voice simulation (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/stop",
                error=True,
            )
        except Exception:
            pass


# FastAPI endpoints for voice stop
@client_router.post("/voice_stop", response_model=dict[str, bool])
async def simulation_voice_stop_api(request: StopVoicePayload) -> dict[str, bool]:
    """Client-to-server event: Stop a voice simulation session."""
    return {"success": True}


@server_router.post("/voice_stop_response", response_model=dict[str, bool])
async def simulation_voice_stop_response_api(
    request: StopVoiceResponsePayload,
) -> dict[str, bool]:
    """Server-to-client event: Voice simulation stop response."""
    return {"success": True}


@server_router.post("/voice_stop_error", response_model=dict[str, bool])
async def simulation_voice_stop_error_api(
    request: StopVoiceErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while stopping voice simulation."""
    return {"success": True}
