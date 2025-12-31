"""WebSocket handler wrapper for consistency."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.typed_emit import emit_to_client

TRequest = TypeVar("TRequest", bound=BaseModel)
TResponse = TypeVar("TResponse", bound=BaseModel)


async def handle_client_event(
    sid: str,
    data: dict[str, Any],
    request_type: type[TRequest],
    handler: Callable[[str, TRequest, uuid.UUID], Awaitable[None]],
    error_event_name: str | None = None,
    error_response_type: type[TResponse] | None = None,
) -> None:
    """Wrapper for client-to-server event handlers.

    Handles:
    - Profile ID lookup from sid
    - Request validation with auto-generated types
    - Error handling and emission

    Args:
        sid: Socket ID
        data: Raw event data
        request_type: Auto-generated ApiRequest type
        handler: Implementation function (sid, validated_request, profile_id)
        error_event_name: Optional error event name for error emission
        error_response_type: Optional error response type
    """
    try:
        # Get profile_id from sid (O(1) Redis lookup)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            if error_event_name and error_response_type:
                await emit_to_client(
                    error_event_name,
                    error_response_type(
                        success=False,
                        message="No profile found for socket",
                    ),
                    room=sid,
                )
            return

        profile_id = uuid.UUID(profile_id_str)

        # Validate with auto-generated type
        validated = request_type(**data)
        await handler(sid, validated, profile_id)
        return
    except ValidationError:
        # Socket.IO logs validation errors automatically
        if error_event_name and error_response_type:
            await emit_to_client(
                error_event_name,
                error_response_type(
                    success=False,
                    message="Invalid payload",
                ),
                room=sid,
            )


async def handle_internal_event(
    data: dict[str, Any],
    request_type: type[TRequest],
    handler: Callable[[str, TRequest, uuid.UUID, uuid.UUID | None], Awaitable[None]],
    error_event_name: str | None = None,
    error_response_type: type[TResponse] | None = None,
) -> None:
    """Wrapper for internal (server-to-server) event handlers.

    Handles:
    - sid extraction
    - Profile ID lookup
    - group_id extraction
    - Request validation
    - Error handling

    Args:
        data: Raw event data with sid and group_id
        request_type: Auto-generated ApiRequest type
        handler: Implementation function (sid, validated_request, profile_id, group_id)
        error_event_name: Optional error event name
        error_response_type: Optional error response type
    """
    sid = data.get("sid")
    if not sid:
        return  # Socket.IO logs missing sid automatically

    try:
        # Get profile_id from sid (O(1) Redis lookup)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            if error_event_name and error_response_type:
                await emit_to_client(
                    error_event_name,
                    error_response_type(
                        success=False,
                        message="No profile found for socket",
                    ),
                    room=sid,
                )
            return

        profile_id = uuid.UUID(profile_id_str)

        # Extract group_id (required for grouping runs)
        group_id_str = data.get("group_id")
        group_id = uuid.UUID(group_id_str) if group_id_str else None

        # Remove sid and group_id before validation (not in ApiRequest)
        payload_dict = {k: v for k, v in data.items() if k not in ("sid", "group_id")}
        validated = request_type(**payload_dict)
        await handler(sid, validated, profile_id, group_id)
        return
    except ValidationError:
        # Socket.IO logs validation errors automatically
        if error_event_name and error_response_type:
            await emit_to_client(
                error_event_name,
                error_response_type(
                    success=False,
                    message="Invalid payload",
                ),
                room=sid,
            )
