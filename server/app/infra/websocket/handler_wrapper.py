"""WebSocket handler wrapper for consistency."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.typed_emit import emit_to_client

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
        # Wrap in try-catch to prevent recursion if lookup fails
        profile_id_str = None
        try:
            profile_id_str = await find_profile_by_socket(sid)
        except Exception as lookup_error:
            # If Redis lookup fails (e.g., recursion error), try in-memory fallback
            # This prevents infinite recursion while still allowing error propagation
            try:
                from app.globals import get_socket_owner_dict

                socket_owner = get_socket_owner_dict()
                # Try in-memory fallback (reverse lookup: find profile_id by socket_id)
                for profile_id, owner_sid in socket_owner.items():
                    if owner_sid == sid:
                        profile_id_str = profile_id
                        break
            except Exception:
                # If even in-memory lookup fails, we can't proceed
                # But we should still emit an error to the client
                if error_event_name:
                    try:
                        # Emit error directly to client using sid as room (doesn't require profile lookup)
                        from app.globals import sio

                        if error_event_name == "generate_error":
                            # For generate_error, emit to internal bus
                            from app.globals import get_internal_sio

                            internal_sio = get_internal_sio()
                            await internal_sio.emit(
                                error_event_name,
                                {
                                    "sid": sid,
                                    "error_message": f"Profile lookup failed: {str(lookup_error)}",
                                    "resource_id": data.get("resource_id"),
                                    "group_id": data.get("group_id"),
                                    "resource_type": data.get("resource_type"),
                                },
                            )
                        else:
                            # For other errors, emit directly to client
                            await sio.emit(
                                error_event_name,
                                {
                                    "success": False,
                                    "message": f"Profile lookup failed: {str(lookup_error)}",
                                },
                                room=sid,
                            )
                    except Exception:
                        # If emitting also fails, just return silently to prevent infinite recursion
                        pass
                return

        if not profile_id_str:
            if error_event_name and error_response_type:
                # Special handling for generate_error - emit to internal bus
                if error_event_name == "generate_error":
                    try:
                        from app.globals import get_internal_sio

                        internal_sio = get_internal_sio()
                        await internal_sio.emit(
                            error_event_name,
                            {
                                "sid": sid,
                                "error_message": "No profile found for socket",
                                "resource_id": data.get("resource_id"),
                                "group_id": data.get("group_id"),
                                "resource_type": data.get("resource_type"),
                            },
                        )
                    except Exception:
                        pass
                else:
                    try:
                        await emit_to_client(
                            error_event_name,
                            error_response_type(
                                success=False,
                                message="No profile found for socket",
                            ),
                            room=sid,
                        )
                    except Exception:
                        pass
            return

        profile_id_uuid = uuid.UUID(profile_id_str)

        # Extract group_id (required for grouping runs)
        group_id_str = data.get("group_id")
        group_id_uuid = uuid.UUID(group_id_str) if group_id_str else None

        # Remove sid and group_id before validation (not in ApiRequest)
        # EXCEPTION: Some ApiRequest models (like GenerateErrorApiRequest) include sid as a field
        # Check if the model has 'sid' as a field - if so, keep it
        model_fields = getattr(request_type, "model_fields", {})
        fields_to_remove = []
        if "sid" not in model_fields:
            fields_to_remove.append("sid")
        if "group_id" not in model_fields:
            fields_to_remove.append("group_id")

        payload_dict = {k: v for k, v in data.items() if k not in fields_to_remove}
        validated = request_type(**payload_dict)
        await handler(sid, validated, profile_id_uuid, group_id_uuid)
        return
    except ValidationError:
        # Socket.IO logs validation errors automatically
        # Special handling for generate_error - emit directly to avoid recursion
        if error_event_name == "generate_error":
            if sid:
                try:
                    from app.globals import get_internal_sio

                    internal_sio = get_internal_sio()
                    await internal_sio.emit(
                        "generate_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": "An error occurred while processing your request. Please try again or reconnect.",
                            "resource_id": data.get("resource_id"),
                            "group_id": data.get("group_id"),
                        },
                    )
                except Exception:
                    pass
            return

        if error_event_name and error_response_type:
            # For other error events (not generate_error), try to emit to client
            if error_event_name != "generate_error":
                # For other error events, try to emit to client
                # But only if the error_response_type has the expected fields
                try:
                    await emit_to_client(
                        error_event_name,
                        error_response_type(
                            success=False,
                            message="Invalid payload",
                        ),
                        room=sid,
                    )
                except Exception:
                    # If error_response_type doesn't match, log and skip
                    pass
    except Exception as e:
        # Catch any other exceptions (like recursion errors) and prevent infinite loops
        # Don't try to emit errors from error handlers - just log and return
        if error_event_name == "generate_error":
            # If we're in generate_error handler and hit an exception, don't recurse
            return
        # For other handlers, try to emit error but catch exceptions to prevent recursion
        if error_event_name and error_response_type and sid:
            try:
                if error_event_name == "generate_error":
                    from app.globals import get_internal_sio

                    internal_sio = get_internal_sio()
                    await internal_sio.emit(
                        error_event_name,
                        {
                            "sid": sid,
                            "error_message": f"Handler error: {str(e)}",
                            "resource_id": data.get("resource_id"),
                            "group_id": data.get("group_id"),
                            "resource_type": data.get("resource_type"),
                        },
                    )
                else:
                    await emit_to_client(
                        error_event_name,
                        error_response_type(
                            success=False,
                            message=f"Handler error: {str(e)}",
                        ),
                        room=sid,
                    )
            except Exception:
                # If emitting fails, don't recurse - just return
                pass
