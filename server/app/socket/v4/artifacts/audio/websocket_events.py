"""WebSocket audio event handlers - handle binary audio frames and JSON events from client."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from pydantic import BaseModel

from .websocket.session_manager import get_session_manager

internal_sio = get_internal_sio()


class AudioWebSocketConnectApiRequest(BaseModel):
    """Payload for WebSocket connection."""

    run_id: str
    auth_token: str | None = None


class AudioWebSocketEventApiRequest(BaseModel):
    """Payload for WebSocket JSON event."""

    run_id: str
    event_data: dict[str, Any]


async def _audio_websocket_connect_impl(
    sid: str,
    data: AudioWebSocketConnectApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle WebSocket connection from client.

    Client connects and provides run_id to associate with session.
    """
    try:
        run_id = uuid.UUID(data.run_id)
        session_manager = get_session_manager()
        
        # Verify session exists
        if not session_manager.has_session(run_id):
            await sio.emit(
                "audio_websocket_error",
                {
                    "success": False,
                    "message": f"Session not found for run_id: {data.run_id}",
                },
                room=sid,
            )
            return
        
        # Get session and set client sid
        adapter = session_manager.get_session(run_id)
        if adapter:
            adapter.set_client_sid(sid)
        
        await sio.emit(
            "audio_websocket_connected",
            {
                "success": True,
                "run_id": data.run_id,
            },
            room=sid,
        )
    except Exception as e:
        await sio.emit(
            "audio_websocket_error",
            {
                "success": False,
                "message": f"Failed to connect WebSocket: {str(e)}",
            },
            room=sid,
        )


async def _audio_websocket_audio_impl(
    sid: str,
    data: bytes,
    profile_id: uuid.UUID,
) -> None:
    """Handle binary audio frame from client.

    Note: This handler receives raw bytes, so we need to get run_id from a different source.
    For now, we'll use a mapping from sid to run_id stored in the session manager.
    """
    # TODO: Store sid -> run_id mapping in session manager
    # For now, this is a placeholder - actual implementation will need to track sid -> run_id
    pass


async def _audio_websocket_event_impl(
    sid: str,
    data: AudioWebSocketEventApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle JSON event from client."""
    try:
        run_id = uuid.UUID(data.run_id)
        session_manager = get_session_manager()
        
        # Route event to session
        await session_manager.handle_event(run_id, data.event_data)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to handle WebSocket event: {str(e)}",
                resource_id=None,
                resource_type="audio",
            ),
            sid=sid,
        )


async def _audio_websocket_disconnect_impl(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
) -> None:
    """Handle WebSocket disconnection."""
    try:
        run_id_str = data.get("run_id")
        if not run_id_str:
            return
        
        run_id = uuid.UUID(run_id_str)
        session_manager = get_session_manager()
        
        # Cleanup session
        await session_manager.cleanup_session(run_id)
    except Exception:
        pass


# Socket.IO event handlers
@sio.event  # type: ignore
async def audio_websocket_connect(sid: str, data: dict[str, Any]) -> None:
    """Handle audio_websocket_connect event from client."""
    await handle_internal_event(
        data=data,
        request_type=AudioWebSocketConnectApiRequest,
        handler=_audio_websocket_connect_impl,  # type: ignore[arg-type]
        error_event_name="audio_websocket_error",
        error_response_type=None,
    )


@sio.event  # type: ignore
async def audio_websocket_event(sid: str, data: dict[str, Any]) -> None:
    """Handle audio_websocket_event event from client."""
    await handle_internal_event(
        data=data,
        request_type=AudioWebSocketEventApiRequest,
        handler=_audio_websocket_event_impl,  # type: ignore[arg-type]
        error_event_name="generate_error",
        error_response_type=GenerateErrorApiRequest,
    )


@sio.on("disconnect")  # type: ignore
async def audio_websocket_disconnect(sid: str) -> None:
    """Handle client disconnection - cleanup WebSocket sessions."""
    # TODO: Track sid -> run_id mapping to cleanup on disconnect
    pass
