"""Generate socket resource handler files for all missing resources."""

import os

BASE_DIR = "server/app/socket/v4/resources"

# All resources that need socket handlers (excluding the 10 that already exist)
NEW_RESOURCES = [
    "agents",
    "arg_positions",
    "args",
    "args_outputs",
    "auth_item_keys",
    "auths",
    "bindings",
    "cohorts",
    "conditional_parameters",
    "documents",
    "domains",
    "emails",
    "endpoints",
    "evals",
    "group_positions",
    "group_rubrics",
    "groups",
    "images",
    "items",
    "keys",
    "modalities",
    "models",
    "objectives",
    "options",
    "personas",
    "points",
    "pricing",
    "problem_statements",
    "profiles",
    "prompts",
    "protocols",
    "provider_keys",
    "providers",
    "qualities",
    "questions",
    "reasoning_levels",
    "request_limits",
    "role_routes",
    "roles",
    "routes",
    "rubrics",
    "run_positions",
    "run_rubrics",
    "scenario_flags",
    "scenario_personas",
    "scenario_positions",
    "scenario_rubrics",
    "scenario_time_limits",
    "scenarios",
    "settings",
    "simulation_positions",
    "simulations",
    "slugs",
    "standard_groups",
    "standards",
    "temperature_levels",
    "texts",
    "thresholds",
    "tools",
    "uploads",
    "values",
    "videos",
    "voices",
]


def to_pascal(name: str) -> str:
    return "".join(part.capitalize() for part in name.split("_"))


def gen_types(resource: str) -> str:
    pascal = to_pascal(resource)
    return f'''"""Typed event models for {resource} resource generation."""

from typing import Any

from pydantic import BaseModel


class {pascal}GenerationCompleteEvent(BaseModel):
    """Server-to-client event: {resource}_generation_complete."""

    artifact_type: str
    resource_type: str = "{resource}"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
'''


def gen_start(resource: str) -> str:
    pascal = to_pascal(resource)
    return f'''"""{pascal} resource start handler."""

from typing import Any

from app.main import sio
from app.socket.v4.resources.types import ResourceStartEvent


async def handle_start(data: dict[str, Any]) -> None:
    """{pascal} generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceStartEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type="{resource}",
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "{resource}_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )
'''


def gen_progress(resource: str) -> str:
    pascal = to_pascal(resource)
    return f'''"""{pascal} resource progress handler."""

from typing import Any

from app.main import sio
from app.socket.v4.resources.types import ResourceProgressEvent


async def handle_progress(data: dict[str, Any]) -> None:
    """{pascal} generation progress - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceProgressEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type="{resource}",
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments_delta=data.get("arguments_delta"),
        arguments=data.get("arguments"),
    )

    await sio.emit(
        "{resource}_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )
'''


def gen_error(resource: str) -> str:
    pascal = to_pascal(resource)
    return f'''"""{pascal} resource error handler."""

from typing import Any

from app.main import sio
from app.socket.v4.resources.types import ResourceErrorEvent


async def handle_error(data: dict[str, Any]) -> None:
    """{pascal} generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceErrorEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type="{resource}",
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
        "{resource}_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
'''


def gen_complete(resource: str) -> str:
    pascal = to_pascal(resource)
    return f'''"""{pascal} resource completion handler."""

import uuid
from typing import Any

from app.api.v4.resources.{resource}.get import get_{resource}_internal
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.resources.{resource}.types import {pascal}GenerationCompleteEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def handle_complete(data: dict[str, Any]) -> None:
    """Handle {resource} generation complete - hydrate and emit typed event."""
    sid = data.get("sid", "")
    group_id_str = data.get("group_id", "")
    run_id = data.get("run_id")
    tool_result = data.get("result") or {{}}
    resource_id_str = tool_result.get("resource_id")

    if not sid or not resource_id_str:
        return

    resource_id = uuid.UUID(resource_id_str)

    try:
        async with get_db_connection() as conn:
            items = await get_{resource}_internal(conn, [resource_id])
            if not items:
                return
            item = items[0]
            resource_data = (
                item.model_dump(mode="json") if hasattr(item, "model_dump") else {{}}
            )
    except Exception as e:
        logger.exception(f"Failed to fetch {resource}/{{resource_id}}: {{e}}")
        return

    event = {pascal}GenerationCompleteEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_id=resource_id_str,
        group_id=group_id_str,
        run_id=run_id,
        data=resource_data,
    )

    await sio.emit(
        "{resource}_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )
'''


def gen_init(resource: str) -> str:
    pascal = to_pascal(resource)
    return f'''"""{pascal} resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.{resource}.types import {pascal}GenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/{resource}_generation_complete")
async def {resource}_generation_complete_api(
    request: {pascal}GenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: {pascal} generation completed."""
    return {{"success": True}}


@server_router.post("/{resource}_generation_started")
async def {resource}_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: {pascal} generation started."""
    return {{"success": True}}


@server_router.post("/{resource}_generation_progress")
async def {resource}_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: {pascal} generation progress."""
    return {{"success": True}}


@server_router.post("/{resource}_generation_error")
async def {resource}_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: {pascal} generation error."""
    return {{"success": True}}
'''


def main() -> None:
    created = 0
    for resource in NEW_RESOURCES:
        resource_dir = os.path.join(BASE_DIR, resource)
        os.makedirs(resource_dir, exist_ok=True)

        files = {
            "__init__.py": gen_init(resource),
            "types.py": gen_types(resource),
            "start.py": gen_start(resource),
            "progress.py": gen_progress(resource),
            "complete.py": gen_complete(resource),
            "error.py": gen_error(resource),
        }

        for filename, content in files.items():
            filepath = os.path.join(resource_dir, filename)
            with open(filepath, "w") as f:
                f.write(content)
            created += 1

    print(f"Created {created} files across {len(NEW_RESOURCES)} resources")


if __name__ == "__main__":
    main()
