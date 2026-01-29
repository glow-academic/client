"""Scenario completion handler - listens to generate_call_complete events and emits granular scenario events."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetScenarioResourceIdsByGroupIdSqlParams,
    GetScenarioResourceIdsByGroupIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v4/queries/scenarios/get_scenario_resource_ids_by_group_id_complete.sql"
)


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_scenario_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete events - filter by scenario artifact_type and emit granular event."""
    # Skip processing if in eval mode - benchmark handlers will handle evals
    eval_mode = data.get("eval_mode", False)
    if eval_mode:
        return  # Don't process evals - benchmark handlers will handle them

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
    profile_id = uuid.UUID(profile_id_str)

    # Extract all data from event (no Python filtering for resource_type - SQL handles it)
    group_id_str = data.get("group_id")
    event_type = data.get("event_type")
    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]
    if event_type == "tool_call_complete" and not tool_result and not tool_results:
        return
    resource_id_str = tool_result.get("resource_id")
    resource_type = data.get("resource_type")

    if not group_id_str or not resource_type:
        return

    if not resource_id_str:
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

    group_id = uuid.UUID(group_id_str)
    resource_id = uuid.UUID(resource_id_str)

    # Query SQL function - SQL handles validation and mapping (no-op, no queries)
    try:
        async with get_db_connection() as conn:
            params = GetScenarioResourceIdsByGroupIdSqlParams(
                profile_id=profile_id,
                group_id=group_id,
                resource_id=resource_id,
                resource_type=resource_type,
                artifact_type="scenario",  # Always "scenario" for this handler
            )
            result = cast(
                GetScenarioResourceIdsByGroupIdSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )
    except Exception as e:
        # SQL function raised error (validation failed) - emit error to client
        await sio.emit(
            "artifact_generation_error",
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

    # Emit granular event with mapped resource ID (one field set, others NULL)
    await sio.emit(
        "scenario_generation_complete",
        {
            "artifact_type": "scenario",
            "group_id": group_id_str,
            "resource_type": resource_type,
            "name_id": str(result.name_id) if result.name_id else None,
            "description_id": str(result.description_id)
            if result.description_id
            else None,
            "problem_statement_id": str(result.problem_statement_id)
            if result.problem_statement_id
            else None,
            "active_flag_id": str(result.active_flag_id)
            if result.active_flag_id
            else None,
            "objective_ids": [str(oid) for oid in (result.objective_ids or [])],
            "department_ids": [str(did) for did in (result.department_ids or [])],
            "persona_ids": [str(pid) for pid in (result.persona_ids or [])],
            "document_ids": [str(did) for did in (result.document_ids or [])],
            "template_ids": [str(tid) for tid in (result.template_ids or [])],
            "parameter_ids": [str(pid) for pid in (result.parameter_ids or [])],
            "field_ids": [str(fid) for fid in (result.field_ids or [])],
            "image_ids": [str(iid) for iid in (result.image_ids or [])],
            "video_ids": [str(vid) for vid in (result.video_ids or [])],
            "question_ids": [str(qid) for qid in (result.question_ids or [])],
            "success": True,
            "message": f"{resource_type} generation completed successfully",
            "run_id": data.get("run_id"),
            "type": data.get("type", "complete"),
        },
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
    profile_id = uuid.UUID(profile_id_str)

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

    try:
        async with get_db_connection() as conn:
            if resource_type == "images":
                sql = load_sql(
                    "app/sql/v4/queries/images/complete_image_generation_complete.sql"
                )
                await conn.fetchrow(
                    sql,
                    uuid.UUID(resource_id_str),
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
                    uuid.UUID(resource_id_str),
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

    group_id = uuid.UUID(group_id_str)
    resource_id = uuid.UUID(resource_id_str)

    try:
        async with get_db_connection() as conn:
            params = GetScenarioResourceIdsByGroupIdSqlParams(
                profile_id=profile_id,
                group_id=group_id,
                resource_id=resource_id,
                resource_type=resource_type,
                artifact_type="scenario",
            )
            result = cast(
                GetScenarioResourceIdsByGroupIdSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
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

    await sio.emit(
        "scenario_generation_complete",
        {
            "artifact_type": "scenario",
            "group_id": group_id_str,
            "resource_type": resource_type,
            "name_id": str(result.name_id) if result.name_id else None,
            "description_id": str(result.description_id)
            if result.description_id
            else None,
            "problem_statement_id": str(result.problem_statement_id)
            if result.problem_statement_id
            else None,
            "objective_id": str(result.objective_id) if result.objective_id else None,
            "scenario_flag_id": str(result.scenario_flag_id)
            if result.scenario_flag_id
            else None,
            "template_id": str(result.template_id) if result.template_id else None,
            "image_ids": [str(iid) for iid in (result.image_ids or [])],
            "video_ids": [str(vid) for vid in (result.video_ids or [])],
            "question_ids": [str(qid) for qid in (result.question_ids or [])],
            "persona_ids": [str(pid) for pid in (result.persona_ids or [])],
            "document_ids": [str(did) for did in (result.document_ids or [])],
            "parameter_ids": [str(pid) for pid in (result.parameter_ids or [])],
            "field_ids": [str(fid) for fid in (result.field_ids or [])],
            "department_ids": [str(did) for did in (result.department_ids or [])],
            "success": True,
            "message": f"{resource_type} generation completed successfully",
            "run_id": run_id,
            "type": data.get("type", "complete"),
        },
        room=sid,
    )
