"""Resource event dispatcher - routes internal_sio events to per-resource handlers.

Registers listeners on generate_call_complete, generate_call_start, generate_call_progress,
and generate_call_error. Routes to the appropriate per-resource handler based on resource_type.

Start/progress/error handlers are generic (same for all resources).
Complete handlers are per-resource (each hydrates via get_*_internal).
"""

from collections.abc import Awaitable, Callable
from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v4.resources.colors.complete import (
    handle_complete as colors_complete,
)
from app.socket.v4.resources.departments.complete import (
    handle_complete as departments_complete,
)
from app.socket.v4.resources.descriptions.complete import (
    handle_complete as descriptions_complete,
)
from app.socket.v4.resources.examples.complete import (
    handle_complete as examples_complete,
)
from app.socket.v4.resources.flags.complete import (
    handle_complete as flags_complete,
)
from app.socket.v4.resources.icons.complete import (
    handle_complete as icons_complete,
)
from app.socket.v4.resources.instructions.complete import (
    handle_complete as instructions_complete,
)
from app.socket.v4.resources.names.complete import (
    handle_complete as names_complete,
)
from app.socket.v4.resources.parameter_fields.complete import (
    handle_complete as parameter_fields_complete,
)
from app.socket.v4.resources.parameters.complete import (
    handle_complete as parameters_complete,
)
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Per-resource complete handlers
COMPLETE_HANDLERS: dict[str, Callable[[dict[str, Any]], Awaitable[None]]] = {
    "names": names_complete,
    "descriptions": descriptions_complete,
    "colors": colors_complete,
    "icons": icons_complete,
    "instructions": instructions_complete,
    "flags": flags_complete,
    "departments": departments_complete,
    "parameter_fields": parameter_fields_complete,
    "examples": examples_complete,
    "parameters": parameters_complete,
}

# Alias: "fields" -> "parameter_fields"
RESOURCE_TYPE_ALIASES: dict[str, str] = {
    "fields": "parameter_fields",
}


def _resolve_resource_type(data: dict[str, Any]) -> str | None:
    """Extract resource_type from event data.

    Checks result.resource_type first (set by tool_executor), then
    falls back to the top-level resource_type from the payload.
    Applies aliases (e.g., "fields" -> "parameter_fields").
    """
    result = data.get("result") or {}
    resource_type = result.get("resource_type") or data.get("resource_type")
    if resource_type:
        resource_type = RESOURCE_TYPE_ALIASES.get(resource_type, resource_type)
    return resource_type


# =============================================================================
# Internal SIO listeners
# =============================================================================


@internal_sio.on("generate_call_complete")  # type: ignore
async def dispatch_call_complete(data: dict[str, Any]) -> None:
    """Route tool_call_complete/tool_result events to per-resource complete handlers."""
    event_type = data.get("event_type")
    if event_type not in ("tool_call_complete", "tool_result"):
        return

    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    # Only dispatch tool_result (has actual result data for hydration)
    if event_type == "tool_result":
        handler = COMPLETE_HANDLERS.get(resource_type)
        if handler:
            await handler(data)


@internal_sio.on("generate_call_start")  # type: ignore
async def dispatch_call_start(data: dict[str, Any]) -> None:
    """Route tool_call_start events - emit per-resource started event."""
    event_type = data.get("event_type")
    if event_type != "tool_call_start":
        return

    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceStartEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type=resource_type,
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        f"{resource_type}_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


@internal_sio.on("generate_call_progress")  # type: ignore
async def dispatch_call_progress(data: dict[str, Any]) -> None:
    """Route tool_call_delta events - emit per-resource progress event."""
    event_type = data.get("event_type")
    if event_type != "tool_call_delta":
        return

    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceProgressEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type=resource_type,
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments_delta=data.get("arguments_delta"),
        arguments=data.get("arguments"),
    )

    await sio.emit(
        f"{resource_type}_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


@internal_sio.on("generate_call_error")  # type: ignore
async def dispatch_call_error(data: dict[str, Any]) -> None:
    """Route error events - emit per-resource error event."""
    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceErrorEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type=resource_type,
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        success=False,
        message=data.get("message") or data.get("error_message") or "Unknown error",
        error_stage=data.get("error_stage"),
        tool_name=data.get("tool_name"),
        tool_call_id=data.get("tool_call_id"),
        arguments=data.get("arguments"),
    )

    await sio.emit(
        f"{resource_type}_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
