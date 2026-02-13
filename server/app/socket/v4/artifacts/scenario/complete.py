"""Scenario completion handler - listens to generate_call_complete events and emits granular scenario events."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.images.types import get_images_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.objectives.types import get_objectives_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.problem_statements.types import (
    get_problem_statements_internal,
)
from app.api.v4.resources.questions.types import get_questions_internal
from app.api.v4.resources.videos.types import get_videos_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.scenario.types import ScenarioGenerationCompleteEvent
from app.utils.sql_helper import load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_scenario_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete events - filter by scenario artifact_type and emit granular event."""

    # Filter by artifact_type (SQL will also validate, but early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "scenario":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Get profile_id from sid
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    # Extract all data from event (no Python filtering for resource_type - SQL handles it)
    group_id_str = data.get("group_id")
    event_type = data.get("event_type")
    resource_type = data.get("resource_type")

    # Only process actual tool completion events, not summary events
    if event_type not in ("tool_call_complete", "tool_result"):
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]
    if event_type == "tool_call_complete" and not tool_result and not tool_results:
        return
    resource_id_str = tool_result.get("resource_id")

    if not group_id_str or not resource_type:
        return

    if not resource_id_str:
        # Check if this was a tool failure (e.g., duplicate key error)
        # In that case, the error was already returned to the model for retry
        # and we don't need to emit an error event to the client
        tool_success = tool_result.get("success", True)
        if not tool_success:
            # Tool execution failed - this is expected and model can retry
            # Don't emit error since other successful calls may have completed
            return
        await sio.emit(
            "scenario_generation_error",
            {
                "artifact_type": "scenario",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    resource_id = uuid.UUID(resource_id_str)

    # Build the event with the appropriate resource field populated
    event = ScenarioGenerationCompleteEvent(
        artifact_type="scenario",
        group_id=group_id_str,
        resource_type=resource_type,
        run_id=data.get("run_id"),
        success=True,
        message=f"{resource_type} generation completed successfully",
    )

    try:
        async with get_db_connection() as conn:
            # Fetch the resource using the appropriate internal function
            # Each function handles caching and returns the correct type
            if resource_type == "names":
                items = await get_names_internal(conn, [resource_id])
                event.name_resource = items[0] if items else None
            elif resource_type == "descriptions":
                items = await get_descriptions_internal(conn, [resource_id])
                event.description_resource = items[0] if items else None
            elif resource_type == "problem_statements":
                items = await get_problem_statements_internal(conn, [resource_id])
                event.problem_statement_resource = items[0] if items else None
            elif resource_type == "scenario_flags" or resource_type == "flags":
                items = await get_flags_internal(conn, [resource_id])
                event.flag_resources = items if items else None
            elif resource_type == "departments":
                items = await get_departments_internal(conn, [resource_id])
                event.department_resources = items if items else None
            elif resource_type == "personas":
                items = await get_personas_internal(conn, [resource_id])
                event.persona_resources = items if items else None
            elif resource_type == "documents":
                items = await get_documents_internal(conn, [resource_id])
                event.document_resources = items if items else None
            elif resource_type == "objectives":
                items = await get_objectives_internal(conn, [resource_id])
                event.objective_resources = items if items else None
            elif resource_type == "questions":
                items = await get_questions_internal(conn, [resource_id])
                event.question_resources = items if items else None
            elif resource_type == "images":
                items = await get_images_internal(conn, [resource_id])
                event.image_resources = items if items else None
            elif resource_type == "videos":
                items = await get_videos_internal(conn, [resource_id])
                event.video_resources = items if items else None
            elif resource_type == "parameters":
                items = await get_parameters_internal(conn, [resource_id])
                event.parameter_resources = items if items else None
            elif resource_type == "parameter_fields" or resource_type == "fields":
                items = await get_parameter_fields_internal(conn, [resource_id])
                event.parameter_field_resources = items if items else None
    except Exception as e:
        # Resource fetch failed - emit error to client
        await sio.emit(
            "scenario_generation_error",
            {
                "artifact_type": "scenario",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    # Emit the typed event
    await sio.emit(
        "scenario_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


@internal_sio.on("generate_image_complete")  # type: ignore
@internal_sio.on("generate_video_complete")  # type: ignore
async def handle_scenario_media_complete(data: dict[str, Any]) -> None:
    """Handle generate_image/video_complete events - create uploads and emit scenario completion."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "scenario":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    group_id_str = data.get("group_id")
    resource_id_str = data.get("resource_id")
    resource_type = data.get("resource_type")
    if not group_id_str or not resource_type or not resource_id_str:
        return

    file_path = data.get("file_path") or data.get("assistant_output")
    mime_type = data.get("mime_type") or (
        "image/png" if resource_type == "images" else "video/mp4"
    )
    file_size = data.get("file_size") or 0
    upload_id = data.get("upload_id")
    run_id = data.get("run_id")

    resource_id = uuid.UUID(resource_id_str)

    try:
        async with get_db_connection() as conn:
            if resource_type == "images":
                sql = load_sql(
                    "app/sql/v4/queries/images/complete_image_generation_complete.sql"
                )
                await conn.fetchrow(
                    sql,
                    resource_id,
                    file_path,
                    mime_type,
                    int(file_size),
                )
            elif resource_type == "videos":
                sql = load_sql(
                    "app/sql/v4/queries/videos/create_generation_and_link_complete.sql"
                )
                await conn.fetchrow(
                    sql,
                    resource_id,
                    file_path,
                    mime_type,
                    uuid.UUID(upload_id) if upload_id else None,
                    True,
                    uuid.UUID(run_id) if run_id else None,
                )
    except Exception as e:
        await sio.emit(
            "scenario_generation_error",
            {
                "artifact_type": "scenario",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    # Build the event with the appropriate resource field populated
    event = ScenarioGenerationCompleteEvent(
        artifact_type="scenario",
        group_id=group_id_str,
        resource_type=resource_type,
        run_id=run_id,
        success=True,
        message=f"{resource_type} generation completed successfully",
    )

    try:
        async with get_db_connection() as conn:
            if resource_type == "images":
                items = await get_images_internal(conn, [resource_id])
                event.image_resources = items if items else None
            elif resource_type == "videos":
                items = await get_videos_internal(conn, [resource_id])
                event.video_resources = items if items else None
    except Exception as e:
        await sio.emit(
            "scenario_generation_error",
            {
                "artifact_type": "scenario",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    # Emit the typed event
    await sio.emit(
        "scenario_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# This registers the event type in OpenAPI, enabling frontend type extraction
# =============================================================================


@server_router.post("/scenario_generation_complete")
async def scenario_generation_complete_api(
    request: ScenarioGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Scenario generation completed.

    Emitted when a scenario resource is successfully generated.
    Contains full resource objects for immediate frontend use.
    """
    return {"success": True}
