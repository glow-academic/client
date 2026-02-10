"""Model completion handler - emits model-specific generation complete events."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.model.permissions import derive_flag_key_and_label
from app.api.v4.artifacts.model.types import ModelFlagConfig
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.modalities.get import get_modalities_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.pricing.get import get_pricing_internal
from app.api.v4.resources.qualities.get import get_qualities_internal
from app.api.v4.resources.reasoning_levels.get import get_reasoning_levels_internal
from app.api.v4.resources.temperature_levels.get import get_temperature_levels_internal
from app.api.v4.resources.values.get import get_values_internal
from app.api.v4.resources.voices.get import get_voices_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.model.types import ModelGenerationCompleteEvent
from app.sql.types import QGetFlagsV4Item
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)

client_router = APIRouter()
server_router = APIRouter()


def _to_model_flag_config(flag: QGetFlagsV4Item) -> ModelFlagConfig:
    key, label = derive_flag_key_and_label(getattr(flag, "name", None))
    return ModelFlagConfig(
        key=key,
        label=label,
        description=getattr(flag, "description", None),
        icon_id=getattr(flag, "icon", None),
        flag_option_id=getattr(flag, "id", None),
        show=True,
        required=False,
        generated=getattr(flag, "generated", None),
    )


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_model_artifact_complete(data: dict[str, Any]) -> None:
    if data.get("artifact_type") != "model":
        return

    sid = data.get("sid")
    if not sid:
        return

    # Extract event metadata
    group_id_str = data.get("group_id")
    resource_type = data.get("resource_type")
    event_type = data.get("event_type")

    # Handle text completion - save assistant message
    if event_type == "text_complete":
        await _handle_model_text_complete(sid, data)
        return

    # Handle run complete - save final assistant content + update tokens
    if event_type == "run_complete":
        await _handle_model_run_complete(sid, data)
        return

    if event_type not in ("tool_call_complete", "tool_result"):
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]
    if event_type == "tool_call_complete" and not tool_result and not tool_results:
        return

    resource_id_str = tool_result.get("resource_id")

    profile_id_str = await find_profile_by_socket(sid)
    if not group_id_str or not profile_id_str or not resource_type:
        return

    if not resource_id_str:
        # Check if this was a tool failure
        tool_success = tool_result.get("success", True)
        if not tool_success:
            return
        await sio.emit(
            "model_generation_error",
            {
                "artifact_type": "model",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    resource_id = uuid.UUID(resource_id_str)

    # Build the typed event with the appropriate resource field populated
    event = ModelGenerationCompleteEvent(
        artifact_type="model",
        group_id=group_id_str,
        resource_type=resource_type,
        run_id=data.get("run_id"),
        success=True,
        message=f"{resource_type} generation completed successfully",
    )

    try:
        async with get_db_connection() as conn:
            # Fetch the resource using the appropriate internal function
            if resource_type == "names":
                items = await get_names_internal(conn, [resource_id])
                event.name_resource = items[0] if items else None
            elif resource_type == "descriptions":
                items = await get_descriptions_internal(conn, [resource_id])
                event.description_resource = items[0] if items else None
            elif resource_type == "values":
                items = await get_values_internal(conn, [resource_id])
                event.value_resource = items[0] if items else None
            elif resource_type == "flags":
                items = await get_flags_internal(conn, [resource_id])
                event.flag_resources = (
                    [_to_model_flag_config(item) for item in items] if items else None
                )
            elif resource_type == "departments":
                items = await get_departments_internal(conn, [resource_id])
                event.department_resources = items if items else None
            elif resource_type == "modalities":
                items = await get_modalities_internal(conn, [resource_id])
                event.modality_resources = items if items else None
            elif resource_type == "temperature_levels":
                items = await get_temperature_levels_internal(conn, [resource_id])
                event.temperature_level_resources = items if items else None
            elif resource_type == "pricing":
                items = await get_pricing_internal(conn, [resource_id])
                event.pricing_resources = items if items else None
            elif resource_type == "reasoning_levels":
                items = await get_reasoning_levels_internal(conn, [resource_id])
                event.reasoning_level_resources = items if items else None
            elif resource_type == "qualities":
                items = await get_qualities_internal(conn, [resource_id])
                event.quality_resources = items if items else None
            elif resource_type == "voices":
                items = await get_voices_internal(conn, [resource_id])
                event.voice_resources = items if items else None
    except Exception as e:
        await sio.emit(
            "model_generation_error",
            {
                "artifact_type": "model",
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
        "model_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


async def _handle_model_text_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle model text generation completion - save assistant message."""
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
        logger.exception(f"Failed to save model text message: {str(e)}")


async def _handle_model_run_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle model generation run completion - save assistant output if present."""
    run_id = data.get("run_id")
    assistant_output = data.get("assistant_output") or ""
    input_tokens = data.get("input_text_tokens", 0)
    output_tokens = data.get("output_text_tokens", 0)

    if not run_id:
        return

    try:
        async with get_db_connection() as conn:
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
        logger.exception(f"Failed to save model run complete: {str(e)}")


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/model_generation_complete")
async def model_generation_complete_api(
    request: ModelGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Model generation completed.

    Emitted when a model resource is successfully generated.
    Contains full resource objects for immediate frontend use.
    """
    return {"success": True}
