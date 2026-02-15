"""Scenario completion handler - handles run/text completion and media uploads.

Resource-level tool_call_complete/tool_result events are now handled by the shared
resource_complete.py handler. This module handles:
- text_complete: save assistant messages
- run_complete: save assistant output and update token counts
- generate_image_complete/generate_video_complete: media upload linking (not covered by resource layer)
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.scenario.save import save_scenario_internal
from app.api.v4.resources.images.get import get_images_internal
from app.api.v4.resources.videos.get import get_videos_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.generation_tracker import (
    cleanup_generation,
    record_agent_complete,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.scenario.types import ScenarioGenerationCompleteEvent
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_scenario_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete and generate_text_complete events - filter by scenario artifact_type."""
    if data.get("artifact_type") != "scenario":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    event_type = data.get("event_type")

    if event_type == "text_complete":
        await _handle_scenario_text_complete(sid, data)
        return

    if event_type == "run_complete":
        await _handle_scenario_run_complete(sid, data)
        return

    # tool_call_complete and tool_result events are now handled by
    # resource_complete.py (shared handler) - nothing to do here


async def _handle_scenario_text_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle scenario text generation completion - save assistant message."""
    run_id = data.get("run_id")
    final_content = data.get("text") or ""

    if not run_id or not final_content:
        return

    try:
        async with get_db_connection() as conn:
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
            await conn.fetchval(
                create_message_sql,
                uuid.UUID(run_id),
                "assistant",
                final_content,
                True,
                False,
            )
    except Exception as e:
        logger.exception(f"Failed to save scenario text message: {str(e)}")


async def _handle_scenario_run_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle scenario generation run completion.

    Coordinates multi-agent completion via generation_tracker:
    1. Saves assistant message and token counts
    2. Records this agent's completion
    3. If all agents done: emits scenario_generation_complete
    4. Cleans up generation tracking
    """
    run_id = data.get("run_id")
    assistant_output = data.get("assistant_output") or ""
    input_tokens = data.get("input_text_tokens", 0)
    output_tokens = data.get("output_text_tokens", 0)
    group_id_str = data.get("group_id")

    if not run_id:
        return

    try:
        async with get_db_connection() as conn:
            # Save assistant message if there's text output
            if assistant_output:
                existing = await conn.fetchval(
                    """
                    SELECT id FROM messages_entry
                    WHERE run_id = $1 AND role = 'assistant'::message_type
                    LIMIT 1
                    """,
                    uuid.UUID(run_id),
                )
                if not existing:
                    create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
                    await conn.fetchval(
                        create_message_sql,
                        uuid.UUID(run_id),
                        "assistant",
                        assistant_output,
                        True,
                        False,
                    )

            # Update run with token counts
            if input_tokens or output_tokens:
                await conn.execute(
                    """
                    UPDATE runs_entry
                    SET input_tokens = COALESCE($2, input_tokens),
                        output_tokens = COALESCE($3, output_tokens)
                    WHERE id = $1
                    """,
                    uuid.UUID(run_id),
                    input_tokens,
                    output_tokens,
                )
    except Exception as e:
        logger.exception(f"Failed to save scenario run complete: {str(e)}")

    # Multi-agent coordination via generation tracker
    tool_results = data.get("tool_results") or []
    is_complete, _all_tool_results = await record_agent_complete(run_id, tool_results)

    if is_complete:
        # All agents finished - auto-save scenario if save=True (default)
        scenario_id: str | None = None

        should_save = data.get("save", True)
        profile_id_str = await find_profile_by_socket(sid)
        if should_save and profile_id_str and group_id_str:
            try:
                profile_id = uuid.UUID(profile_id_str)
                group_id = uuid.UUID(group_id_str)

                # Build resource_actions from all_tool_results
                resource_actions: dict[str, Any] = {}
                for tr in _all_tool_results:
                    if isinstance(tr, dict):
                        rt = tr.get("resource_type")
                        rid = tr.get("resource_id")
                        rids = tr.get("resource_ids")
                        if rt and rid:
                            resource_actions[rt] = {"resource_id": rid}
                        elif rt and rids:
                            resource_actions[rt] = {"resource_ids": rids}

                async with get_db_connection() as conn:
                    saved_id = await save_scenario_internal(
                        conn=conn,
                        profile_id=profile_id,
                        group_id=group_id,
                        resource_actions=resource_actions,
                    )
                    if saved_id:
                        scenario_id = str(saved_id)
            except Exception as e:
                logger.exception(f"Failed to auto-save scenario: {str(e)}")

        # Emit scenario_generation_complete
        event = ScenarioGenerationCompleteEvent(
            artifact_type="scenario",
            group_id=group_id_str or "",
            resource_type="scenario",
            run_id=run_id,
            success=True,
            message="Scenario generation completed",
            scenario_id=scenario_id,
        )

        await sio.emit(
            "scenario_generation_complete",
            event.model_dump(mode="json"),
            room=sid,
        )

        await cleanup_generation(run_id)


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
# =============================================================================


@server_router.post("/scenario_generation_complete")
async def scenario_generation_complete_api(
    request: ScenarioGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Scenario generation completed."""
    return {"success": True}
