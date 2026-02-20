"""Generate socket entry handler files for all entries that don't have them yet.

Each entry gets a socket directory with 6 files:
- types.py (GenerationEvent inheriting from canonical EntryData)
- __init__.py (router wiring)
- start.py, complete.py, error.py, progress.py (4 handler files)
"""

import os
import subprocess
import re

BASE = os.path.dirname(os.path.abspath(__file__))
API_ENTRIES = os.path.join(BASE, "app/api/v4/entries")
SOCKET_ENTRIES = os.path.join(BASE, "app/socket/v4/entries")

# Already-existing socket entry dirs (skip these)
EXISTING = {
    "analyses", "contents", "feedbacks", "highlights", "hints",
    "improvements", "replacements", "responses", "simulation_messages",
    "strengths",
}


def get_entry_data_class(api_dir: str) -> str | None:
    """Extract the EntryData class name from the API types.py."""
    types_path = os.path.join(API_ENTRIES, api_dir, "types.py")
    if not os.path.isfile(types_path):
        return None
    with open(types_path) as f:
        for line in f:
            m = re.match(r"class (\w+EntryData)\(", line)
            if m:
                return m.group(1)
    return None


def to_event_class_name(entry_data_class: str) -> str:
    """ContentsEntryData -> ContentsGenerationEvent"""
    return entry_data_class.replace("EntryData", "GenerationEvent")


def to_human_name(api_dir: str) -> str:
    """attempt_content -> attempt content"""
    return api_dir.replace("_", " ")


def generate_types_py(
    api_dir: str,
    socket_dir: str,
    entry_data_class: str,
    event_class: str,
) -> str:
    human = to_human_name(api_dir)
    return f'''"""Unified event model for {socket_dir} entry socket events."""

from app.api.v4.entries.{api_dir}.types import {entry_data_class}


class {event_class}({entry_data_class}):
    """Unified socket event for {socket_dir} generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "{socket_dir}"
    entry_id: str | None = None
    group_id: str | None = None
    run_id: str | None = None
    # Completion
    success: bool | None = None
    # Error
    message: str | None = None
    error_stage: str | None = None
    # Tool call tracking
    tool_call_id: str | None = None
    tool_name: str | None = None
    # Streaming
    arguments_delta: str | None = None
'''


def generate_init_py(socket_dir: str) -> str:
    human = to_human_name(socket_dir)
    return f'''"""{human.title()} entry socket event handlers."""

from fastapi import APIRouter

# Import handler modules to register internal_sio listeners
from . import complete as _complete  # noqa: F401
from . import error as _error  # noqa: F401
from . import progress as _progress  # noqa: F401
from . import start as _start  # noqa: F401
from .complete import server_router as complete_router
from .error import server_router as error_router
from .progress import server_router as progress_router
from .start import server_router as start_router

server_router = APIRouter()

server_router.include_router(start_router)
server_router.include_router(progress_router)
server_router.include_router(complete_router)
server_router.include_router(error_router)
'''


def generate_start_py(socket_dir: str, event_class: str) -> str:
    human = to_human_name(socket_dir)
    return f'''"""{human.title()} entry start handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.{socket_dir}.types import {event_class}
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_start(data: dict[str, Any]) -> None:
    """{human.title()} generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = {event_class}(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "{socket_dir}_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_start")  # type: ignore
async def {socket_dir}_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_start events targeting {socket_dir}."""
    if data.get("event_type") != "tool_call_start":
        return
    if resolve_entry_type(data) != "{socket_dir}":
        return
    await handle_start(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/{socket_dir}_generation_started")
async def {socket_dir}_generation_started_api(
    request: {event_class},
) -> dict[str, bool]:
    """Server-to-client event: {human.title()} generation started."""
    return {{"success": True}}
'''


def generate_complete_py(socket_dir: str, event_class: str) -> str:
    human = to_human_name(socket_dir)
    return f'''"""{human.title()} entry completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.{socket_dir}.types import {event_class}
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_complete(data: dict[str, Any]) -> None:
    """Handle {socket_dir} generation complete - emit typed event from tool result."""
    sid = data.get("sid", "")
    if not sid:
        return

    tool_result = data.get("result") or {{}}
    entry_id_str = tool_result.get("entry_id")
    entry_data = tool_result.get("entry_data") or {{}}

    event = {event_class}(
        artifact_type=data.get("artifact_type", ""),
        entry_id=entry_id_str,
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        success=True,
        **entry_data,
    )

    await sio.emit(
        "{socket_dir}_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_complete")  # type: ignore
async def {socket_dir}_call_complete_listener(data: dict[str, Any]) -> None:
    """Listen for tool_result events targeting {socket_dir}."""
    if data.get("event_type") != "tool_result":
        return
    if resolve_entry_type(data) != "{socket_dir}":
        return
    await handle_complete(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/{socket_dir}_generation_complete")
async def {socket_dir}_generation_complete_api(
    request: {event_class},
) -> dict[str, bool]:
    """Server-to-client event: {human.title()} generation completed."""
    return {{"success": True}}
'''


def generate_error_py(socket_dir: str, event_class: str) -> str:
    human = to_human_name(socket_dir)
    return f'''"""{human.title()} entry error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.{socket_dir}.types import {event_class}
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """{human.title()} generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {{}}

    event = {event_class}(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        success=False,
        message=data.get("message") or data.get("error_message") or "Unknown error",
        error_stage=data.get("error_stage"),
        tool_name=data.get("tool_name"),
        tool_call_id=data.get("tool_call_id"),
        **resolved_fields,
    )

    await sio.emit(
        "{socket_dir}_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def {socket_dir}_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting {socket_dir}."""
    if resolve_entry_type(data) != "{socket_dir}":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/{socket_dir}_generation_error")
async def {socket_dir}_generation_error_api(
    request: {event_class},
) -> dict[str, bool]:
    """Server-to-client event: {human.title()} generation error."""
    return {{"success": True}}
'''


def generate_progress_py(socket_dir: str, event_class: str) -> str:
    human = to_human_name(socket_dir)
    return f'''"""{human.title()} entry progress handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.{socket_dir}.types import {event_class}
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_progress(data: dict[str, Any]) -> None:
    """{human.title()} generation progress - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {{}}

    event = {event_class}(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments_delta=data.get("arguments_delta"),
        **resolved_fields,
    )

    await sio.emit(
        "{socket_dir}_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_progress")  # type: ignore
async def {socket_dir}_call_progress_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_delta events targeting {socket_dir}."""
    if data.get("event_type") != "tool_call_delta":
        return
    if resolve_entry_type(data) != "{socket_dir}":
        return
    await handle_progress(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/{socket_dir}_generation_progress")
async def {socket_dir}_generation_progress_api(
    request: {event_class},
) -> dict[str, bool]:
    """Server-to-client event: {human.title()} generation progress."""
    return {{"success": True}}
'''


def main() -> None:
    # Collect all API entry dirs
    api_dirs = sorted(
        d
        for d in os.listdir(API_ENTRIES)
        if os.path.isdir(os.path.join(API_ENTRIES, d)) and d != "__pycache__"
    )

    created = []
    skipped_existing = []
    skipped_no_class = []

    for api_dir in api_dirs:
        # For existing socket entries, the socket dir name differs from API dir
        # We only generate for entries that DON'T have socket dirs yet
        # For new entries, socket_dir = api_dir
        socket_dir = api_dir

        # Skip if this API dir maps to an existing socket entry
        # (the existing ones use different names)
        existing_api_to_socket = {
            "attempt_analysis": "analyses",
            "attempt_content": "contents",
            "attempt_feedback": "feedbacks",
            "attempt_highlight": "highlights",
            "attempt_hint": "hints",
            "attempt_improvement": "improvements",
            "attempt_replacement": "replacements",
            "attempt_strength": "strengths",
            "attempt_message": "simulation_messages",
            "responses": "responses",
        }

        if api_dir in existing_api_to_socket:
            skipped_existing.append(api_dir)
            continue

        # Check if socket dir already exists
        socket_path = os.path.join(SOCKET_ENTRIES, socket_dir)
        if os.path.isdir(socket_path):
            skipped_existing.append(api_dir)
            continue

        entry_data_class = get_entry_data_class(api_dir)
        if not entry_data_class:
            skipped_no_class.append(api_dir)
            continue

        event_class = to_event_class_name(entry_data_class)

        # Create socket directory
        os.makedirs(socket_path, exist_ok=True)

        # Write all 6 files
        files = {
            "types.py": generate_types_py(api_dir, socket_dir, entry_data_class, event_class),
            "__init__.py": generate_init_py(socket_dir),
            "start.py": generate_start_py(socket_dir, event_class),
            "complete.py": generate_complete_py(socket_dir, event_class),
            "error.py": generate_error_py(socket_dir, event_class),
            "progress.py": generate_progress_py(socket_dir, event_class),
        }

        for filename, content in files.items():
            filepath = os.path.join(socket_path, filename)
            with open(filepath, "w") as f:
                f.write(content)

        created.append(socket_dir)

    print(f"Created {len(created)} socket entry directories ({len(created) * 6} files)")
    print(f"Skipped {len(skipped_existing)} (already exist)")
    print(f"Skipped {len(skipped_no_class)} (no EntryData class)")

    if created:
        print("\nNew entries:")
        for name in created:
            print(f"  {name}")


if __name__ == "__main__":
    main()
