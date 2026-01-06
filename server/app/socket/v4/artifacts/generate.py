"""Unified artifact generation handler - routes to provider-specific adapters."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (GetGenerationRunContextAndCreateRunSqlParams,
                           GetGenerationRunContextAndCreateRunSqlRow)
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/generate/start/get_generation_run_context_and_create_run_complete.sql"

from app.socket.v4.artifacts.adapters.openai.audio import OpenAIAudioAdapter
from app.socket.v4.artifacts.adapters.openai.image import OpenAIImageAdapter
# Import adapters
from app.socket.v4.artifacts.adapters.openai.text import OpenAITextAdapter
from app.socket.v4.artifacts.adapters.openai.video import OpenAIVideoAdapter

# Mapping from agent_role to handler type (modality)
HANDLER_MAPPING = {
    # Text generation handlers
    "scenario": "text",
    "document": "text",
    "simulation": "text",
    "grade": "text",
    "hint": "text",
    "classify": "text",
    "member": "text",
    "prompt": "text",
    "rubric": "text",
    "title": "text",
    "audio": "text",
    # Image generation
    "image": "image",
    # Video generation
    "video": "video",
    # Audio generation (ephemeral sessions only)
    "voice": "audio",
}


async def _generate_artifact_impl(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
) -> None:
    """Unified entry point for all artifact generation - routes to adapters."""
    try:
        async with get_db_connection() as conn:
            # Call SQL to create group + run + rate limit check + user message (if needed)
            try:
                # Convert message_ids to UUID array if provided
                message_ids_uuid = (
                    [uuid.UUID(mid) for mid in data.get("message_ids", [])]
                    if data.get("message_ids")
                    else None
                )

                params = GetGenerationRunContextAndCreateRunSqlParams(
                    agent_id=uuid.UUID(data["agent_id"]),
                    resource_id=uuid.UUID(data["resource_id"]),
                    resource_type=data["resource_type"],
                    profile_id=profile_id,
                    message_ids=message_ids_uuid,
                    department_id=None,  # Can be NULL, modality handlers will get it
                    group_id=uuid.UUID(data["group_id"]) if data.get("group_id") else None,
                    user_instructions=data.get("user_instructions"),
                    developer_message_contents=data.get("developer_message_contents"),
                )
                result = cast(
                    GetGenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=user_msg,
                            resource_id=data.get("resource_id"),
                            group_id=data.get("group_id"),
                            resource_type=data.get("resource_type"),
                        ),
                        sid=sid,
                    )
                    return
                # Other errors
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to start generation: {str(e)}",
                        resource_id=data.get("resource_id"),
                        group_id=data.get("group_id"),
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create run",
                        resource_id=data.get("resource_id"),
                        group_id=data.get("group_id"),
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )
                return

            # Determine handler type (modality) from agent_role
            modality = HANDLER_MAPPING.get(data.get("resource_type", ""), "text")

            # Determine provider from SQL result
            # Get provider from agent config - for now, we need to fetch it from the result
            # The result should include provider info, but if not, default to "openai"
            provider = getattr(result, "provider", None) or "openai"

            # Build payload for adapter
            adapter_payload = {
                "sid": sid,
                "run_id": result.run_id,  # Already created
                "agent_id": data["agent_id"],
                "resource_id": data["resource_id"],
                "resource_type": data["resource_type"],
                "group_id": str(result.group_id),
                "trace_id": result.trace_id,
                "message_ids": [str(mid) for mid in (result.message_ids or [])],
                "department_id": data.get("department_id"),
            }

            # Route to appropriate adapter based on provider + modality
            if provider == "openai":
                if modality == "text":
                    adapter = OpenAITextAdapter()
                    await adapter.generate(sid, adapter_payload, profile_id, conn)
                elif modality == "image":
                    # Image adapter needs image_id, name, prompt from data
                    adapter_payload.update({
                        "image_id": data.get("image_id") or data.get("resource_id"),
                        "name": data.get("name", "image"),
                        "prompt": data.get("prompt", ""),
                    })
                    adapter = OpenAIImageAdapter()
                    await adapter.generate(sid, adapter_payload, profile_id, conn)
                elif modality == "video":
                    # Video adapter needs videoId, prompt from data
                    adapter_payload.update({
                        "videoId": data.get("videoId") or data.get("resource_id"),
                        "prompt": data.get("prompt", ""),
                        "imageReferenceId": data.get("imageReferenceId"),
                    })
                    adapter = OpenAIVideoAdapter()
                    await adapter.generate(sid, adapter_payload, profile_id, conn)
                elif modality == "audio":
                    # Audio adapter needs uploadId, prompt, agentId from data
                    adapter_payload.update({
                        "uploadId": data.get("uploadId"),
                        "prompt": data.get("prompt", ""),
                        "agentId": data.get("agent_id"),
                        "departmentId": data.get("department_id"),
                    })
                    adapter = OpenAIAudioAdapter()
                    await adapter.generate(sid, adapter_payload, profile_id, conn)
                else:
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Unsupported modality: {modality}",
                            resource_id=data.get("resource_id"),
                            group_id=data.get("group_id"),
                            resource_type=data.get("resource_type"),
                        ),
                        sid=sid,
                    )
            elif provider == "gemini":
                # TODO: Implement Gemini adapters
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Provider {provider} not yet supported",
                        resource_id=data.get("resource_id"),
                        group_id=data.get("group_id"),
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )
            else:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Unknown provider: {provider}",
                        resource_id=data.get("resource_id"),
                        group_id=data.get("group_id"),
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate artifact: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ),
            sid=sid,
        )


@internal_sio.on("generate_artifact")  # type: ignore
async def generate_artifact_internal(data: dict[str, Any]) -> None:
    """Handle generate_artifact event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        # Get profile_id from sid lookup
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    resource_id=data.get("resource_id"),
                    group_id=data.get("group_id"),
                    resource_type=data.get("resource_type"),
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _generate_artifact_impl(sid, data, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ),
            sid=sid,
        )

