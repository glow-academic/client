"""Resource event dispatcher - routes internal_sio events to per-resource handlers.

Registers listeners on generate_call_complete, generate_call_start, generate_call_progress,
and generate_call_error. Routes to the appropriate per-resource handler based on resource_type.

All four event types (start, progress, complete, error) are routed through per-resource
handler files for architectural consistency and strong typing.
"""

from collections.abc import Awaitable, Callable
from typing import Any

from app.main import get_internal_sio
from app.socket.v4.resources.colors.complete import (
    handle_complete as colors_complete,
)
from app.socket.v4.resources.colors.error import handle_error as colors_error
from app.socket.v4.resources.colors.progress import (
    handle_progress as colors_progress,
)
from app.socket.v4.resources.colors.start import handle_start as colors_start
from app.socket.v4.resources.departments.complete import (
    handle_complete as departments_complete,
)
from app.socket.v4.resources.departments.error import (
    handle_error as departments_error,
)
from app.socket.v4.resources.departments.progress import (
    handle_progress as departments_progress,
)
from app.socket.v4.resources.departments.start import (
    handle_start as departments_start,
)
from app.socket.v4.resources.descriptions.complete import (
    handle_complete as descriptions_complete,
)
from app.socket.v4.resources.descriptions.error import (
    handle_error as descriptions_error,
)
from app.socket.v4.resources.descriptions.progress import (
    handle_progress as descriptions_progress,
)
from app.socket.v4.resources.descriptions.start import (
    handle_start as descriptions_start,
)
from app.socket.v4.resources.examples.complete import (
    handle_complete as examples_complete,
)
from app.socket.v4.resources.examples.error import handle_error as examples_error
from app.socket.v4.resources.examples.progress import (
    handle_progress as examples_progress,
)
from app.socket.v4.resources.examples.start import handle_start as examples_start
from app.socket.v4.resources.flags.complete import (
    handle_complete as flags_complete,
)
from app.socket.v4.resources.flags.error import handle_error as flags_error
from app.socket.v4.resources.flags.progress import (
    handle_progress as flags_progress,
)
from app.socket.v4.resources.flags.start import handle_start as flags_start
from app.socket.v4.resources.icons.complete import (
    handle_complete as icons_complete,
)
from app.socket.v4.resources.icons.error import handle_error as icons_error
from app.socket.v4.resources.icons.progress import (
    handle_progress as icons_progress,
)
from app.socket.v4.resources.icons.start import handle_start as icons_start
from app.socket.v4.resources.instructions.complete import (
    handle_complete as instructions_complete,
)
from app.socket.v4.resources.instructions.error import (
    handle_error as instructions_error,
)
from app.socket.v4.resources.instructions.progress import (
    handle_progress as instructions_progress,
)
from app.socket.v4.resources.instructions.start import (
    handle_start as instructions_start,
)
from app.socket.v4.resources.names.complete import (
    handle_complete as names_complete,
)
from app.socket.v4.resources.names.error import handle_error as names_error
from app.socket.v4.resources.names.progress import (
    handle_progress as names_progress,
)
from app.socket.v4.resources.names.start import handle_start as names_start
from app.socket.v4.resources.parameter_fields.complete import (
    handle_complete as parameter_fields_complete,
)
from app.socket.v4.resources.parameter_fields.error import (
    handle_error as parameter_fields_error,
)
from app.socket.v4.resources.parameter_fields.progress import (
    handle_progress as parameter_fields_progress,
)
from app.socket.v4.resources.parameter_fields.start import (
    handle_start as parameter_fields_start,
)
from app.socket.v4.resources.parameters.complete import (
    handle_complete as parameters_complete,
)
from app.socket.v4.resources.parameters.error import (
    handle_error as parameters_error,
)
from app.socket.v4.resources.parameters.progress import (
    handle_progress as parameters_progress,
)
from app.socket.v4.resources.parameters.start import (
    handle_start as parameters_start,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Type alias for handler functions
Handler = Callable[[dict[str, Any]], Awaitable[None]]

# Per-resource handler dicts
COMPLETE_HANDLERS: dict[str, Handler] = {
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

START_HANDLERS: dict[str, Handler] = {
    "names": names_start,
    "descriptions": descriptions_start,
    "colors": colors_start,
    "icons": icons_start,
    "instructions": instructions_start,
    "flags": flags_start,
    "departments": departments_start,
    "parameter_fields": parameter_fields_start,
    "examples": examples_start,
    "parameters": parameters_start,
}

PROGRESS_HANDLERS: dict[str, Handler] = {
    "names": names_progress,
    "descriptions": descriptions_progress,
    "colors": colors_progress,
    "icons": icons_progress,
    "instructions": instructions_progress,
    "flags": flags_progress,
    "departments": departments_progress,
    "parameter_fields": parameter_fields_progress,
    "examples": examples_progress,
    "parameters": parameters_progress,
}

ERROR_HANDLERS: dict[str, Handler] = {
    "names": names_error,
    "descriptions": descriptions_error,
    "colors": colors_error,
    "icons": icons_error,
    "instructions": instructions_error,
    "flags": flags_error,
    "departments": departments_error,
    "parameter_fields": parameter_fields_error,
    "examples": examples_error,
    "parameters": parameters_error,
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
    """Route tool_call_start events to per-resource start handlers."""
    event_type = data.get("event_type")
    if event_type != "tool_call_start":
        return

    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    handler = START_HANDLERS.get(resource_type)
    if handler:
        await handler(data)


@internal_sio.on("generate_call_progress")  # type: ignore
async def dispatch_call_progress(data: dict[str, Any]) -> None:
    """Route tool_call_delta events to per-resource progress handlers."""
    event_type = data.get("event_type")
    if event_type != "tool_call_delta":
        return

    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    handler = PROGRESS_HANDLERS.get(resource_type)
    if handler:
        await handler(data)


@internal_sio.on("generate_call_error")  # type: ignore
async def dispatch_call_error(data: dict[str, Any]) -> None:
    """Route error events to per-resource error handlers."""
    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    handler = ERROR_HANDLERS.get(resource_type)
    if handler:
        await handler(data)
