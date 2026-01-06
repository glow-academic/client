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

# Import adapters - modality-first structure
from app.socket.v4.artifacts.adapters.audio.openai import OpenAIAudioAdapter
from app.socket.v4.artifacts.adapters.image.openai import OpenAIImageAdapter
from app.socket.v4.artifacts.adapters.persistence import (persist_image,
                                                          persist_video)
from app.socket.v4.artifacts.adapters.text.openai import OpenAITextAdapter
from app.socket.v4.artifacts.adapters.video.openai import OpenAIVideoAdapter


def determine_modality_from_output_modalities(
    output_modalities: list[str] | None
) -> str:
    """Determine handler modality from model's output_modalities.
    
    Prefers 'text' if available, otherwise uses first modality.
    Falls back to 'text' if no modalities provided.
    """
    if not output_modalities or len(output_modalities) == 0:
        return "text"  # Default fallback
    
    # Prefer text if available (most common)
    if "text" in output_modalities:
        return "text"
    
    # Otherwise use first modality
    return output_modalities[0]


async def _generate_artifact_impl(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
) -> None:
    """Unified entry point for all artifact generation - routes to adapters."""
    try:
        async with get_db_connection() as conn:
            # Get output_modalities from payload (from generate_start) or query
            if data.get("run_id") and data.get("output_modalities"):
                # Use from payload (already created run via generate_start)
                output_modalities = data.get("output_modalities")
                modality = determine_modality_from_output_modalities(output_modalities)
                # Use existing run_id, group_id, trace_id from payload
                run_id = data["run_id"]
                group_id = data.get("group_id")
                trace_id = data.get("trace_id")
                message_ids = data.get("message_ids", [])
            else:
                # Create run via SQL (direct call to generate_artifact)
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

                modality = determine_modality_from_output_modalities(result.output_modalities)
                run_id = result.run_id
                group_id = str(result.group_id) if result.group_id else None
                trace_id = result.trace_id
                message_ids = [str(mid) for mid in (result.message_ids or [])]
                provider = getattr(result, "provider", None) or "openai"

            # Modality-first adapter mapping
            MODALITY_ADAPTERS = {
                "text": {"openai": OpenAITextAdapter, "gemini": None},  # TODO: Add Gemini
                "image": {"openai": OpenAIImageAdapter, "gemini": None},  # TODO: Add Gemini
                "video": {"openai": OpenAIVideoAdapter, "gemini": None},  # TODO: Add Gemini
                "audio": {"openai": OpenAIAudioAdapter, "gemini": None},  # TODO: Add Gemini
            }

            # Get adapter class
            adapter_class = MODALITY_ADAPTERS.get(modality, {}).get(provider)
            if not adapter_class:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Provider {provider} not yet supported for modality {modality}",
                        resource_id=data.get("resource_id"),
                        group_id=data.get("group_id"),
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )
                return

            # Build payload for adapter
            adapter_payload = {
                "sid": sid,
                "run_id": run_id,
                "agent_id": data["agent_id"],
                "resource_id": data["resource_id"],
                "resource_type": data["resource_type"],
                "group_id": group_id,
                "trace_id": trace_id,
                "message_ids": message_ids,
                "department_id": data.get("department_id"),
            }

            # Special handling for image/video/audio adapters
            if modality == "image":
                adapter_payload.update({
                    "image_id": data.get("image_id") or data.get("resource_id"),
                    "name": data.get("name", "image"),
                    "prompt": data.get("prompt", ""),
                })
            elif modality == "video":
                adapter_payload.update({
                    "videoId": data.get("videoId") or data.get("resource_id"),
                    "prompt": data.get("prompt", ""),
                    "imageReferenceId": data.get("imageReferenceId"),
                })
            elif modality == "audio":
                adapter_payload.update({
                    "uploadId": data.get("uploadId"),
                    "prompt": data.get("prompt", ""),
                    "agentId": data.get("agent_id"),
                    "departmentId": data.get("department_id"),
                })

            # Instantiate and call adapter
            adapter: Any = adapter_class()

            # Handle audio special case - returns AudioSessionConfig
            if modality == "audio":
                if adapter.get_implementation_type() == "webrtc":
                    # Build AgentConfig from result
                    from app.socket.v4.artifacts.adapters.base import \
                        AgentConfig

                    agent_config = AgentConfig(
                        agent_id=data["agent_id"],
                        agent_name=None,  # Not available from payload
                        system_prompt=None,  # Not available from payload
                        temperature=None,  # Not available from payload
                        reasoning=None,  # Not available from payload
                        model_id=None,  # Not available from payload
                        model_name=None,  # Not available from payload
                        provider=provider,
                        base_url=None,  # Not available from payload
                        api_key=None,  # Not available from payload
                        custom_model=None,  # Not available from payload
                        provider_id=None,  # Not available from payload
                        provider_name=None,  # Not available from payload
                    )

                    # Initialize session
                    session_config = await adapter.initialize_session(
                        conn=conn,
                        agent_config=agent_config,
                        resource_id=uuid.UUID(data["resource_id"]),
                        resource_type=data["resource_type"],
                        run_id=uuid.UUID(run_id),
                    )

                    # Emit session config to frontend
                    await internal_sio.emit(
                        "generate_audio_started",
                        {
                            "sid": sid,
                            "success": True,
                            "ephemeral_key": session_config.ephemeral_key,
                            "expires_in": session_config.expires_in,
                            "model": session_config.model,
                            "tools": session_config.tools,
                            "instructions": session_config.instructions,
                            "history": session_config.history,
                            "upload_id": data.get("uploadId"),
                            "run_id": run_id,
                            "message": "Audio generation session started",
                        },
                    )
                    return

            # For text, image, video - call generate method
            if modality == "text":
                await adapter.generate(sid, adapter_payload, profile_id, conn)
            elif modality == "image":
                # Image adapter returns ImageGenerationResult
                image_result = await adapter.generate(sid, adapter_payload, profile_id, conn)
                # Persist image
                image_id = uuid.UUID(adapter_payload["image_id"])
                image_name = adapter_payload["name"]
                file_path = await persist_image(conn, image_id, image_result, image_name)
                # Emit completion event
                await internal_sio.emit(
                    "generate_image_complete",
                    {
                        "sid": sid,
                        "image_id": str(image_id),
                        "file_path": file_path,
                        "mime_type": image_result.mime_type,
                        "file_size": image_result.file_size,
                        "trace_id": trace_id,
                    },
                )
            elif modality == "video":
                # Video adapter returns VideoGenerationResult
                video_result = await adapter.generate(sid, adapter_payload, profile_id, conn)
                # Persist video
                video_id = uuid.UUID(adapter_payload["videoId"])
                run_id_uuid = uuid.UUID(result.run_id)
                file_path = await persist_video(conn, video_id, video_result, run_id_uuid)
                # Emit completion event
                await internal_sio.emit(
                    "generate_video_complete",
                    {
                        "sid": sid,
                        "success": True,
                        "message": "Video generated successfully",
                        "videoUrl": f"/api/uploads/download/{video_result.upload_id}",
                        "video_id": str(video_id),
                        "run_id": run_id,
                    },
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

