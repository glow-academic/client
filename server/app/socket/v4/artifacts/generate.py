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

from app.socket.v4.artifacts.adapters.base.config import (
    AdapterConfig, AdapterEventCallbacks)
from app.socket.v4.artifacts.adapters.base.coordinator import \
    MultiModalityCoordinator
from app.socket.v4.artifacts.adapters.gemini.audio.adapter import \
    GeminiAudioAdapter
from app.socket.v4.artifacts.adapters.gemini.image.adapter import \
    GeminiImageAdapter
from app.socket.v4.artifacts.adapters.gemini.text.adapter import \
    GeminiTextAdapter
from app.socket.v4.artifacts.adapters.gemini.video.adapter import \
    GeminiVideoAdapter
# Import adapters - provider-first structure
from app.socket.v4.artifacts.adapters.openai.audio.adapter import \
    OpenAIAudioAdapter
from app.socket.v4.artifacts.adapters.openai.image.adapter import \
    OpenAIImageAdapter
from app.socket.v4.artifacts.adapters.openai.text.adapter import \
    OpenAITextAdapter
from app.socket.v4.artifacts.adapters.openai.video.adapter import \
    OpenAIVideoAdapter
from app.socket.v4.artifacts.adapters.persistence import (persist_image,
                                                          persist_video)
from app.socket.v4.artifacts.adapters.service.prepare_config import (
    prepare_audio_config, prepare_image_config, prepare_text_config,
    prepare_video_config)


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


async def get_required_modality_for_resource(
    conn: Any,
    resource_type: str,
) -> str | None:
    """Get required modality for a resource type from resource_modalities table.
    
    Args:
        conn: Database connection
        resource_type: Resource type (e.g., "texts", "images", "documents")
    
    Returns:
        Required modality or None if not found
    """
    # Query resource_modalities table
    sql_query = """
        SELECT modality::text
        FROM resource_modalities
        WHERE resource = $1::resources
        AND modality != 'call'::modality_type
        ORDER BY modality
        LIMIT 1
    """
    result = await conn.fetchval(sql_query, resource_type)
    return result if result else None


def should_use_multimodal_coordinator(
    output_modalities: list[str] | None,
) -> bool:
    """Determine if multi-modality coordinator should be used.
    
    Args:
        output_modalities: List of output modalities from model
    
    Returns:
        True if coordinator should be used (multiple modalities in single call)
    """
    if not output_modalities or len(output_modalities) <= 1:
        return False
    
    # Check if this is a known multi-modality scenario
    # e.g., OpenAI Realtime API produces text+audio in single call
    if len(output_modalities) > 1:
        # For now, only handle text+audio (Realtime API)
        if "text" in output_modalities and "audio" in output_modalities:
            return True
    
    return False


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

                    # Handle both domain_id (new) and agent_id (legacy) for backward compatibility
                    domain_id = data.get("domain_id")
                    agent_id = data.get("agent_id")
                    if domain_id:
                        # Look up agent_id from domain_id
                        domain_lookup_sql = "SELECT agent_id FROM domains WHERE id = $1"
                        agent_id_from_domain = await conn.fetchval(domain_lookup_sql, uuid.UUID(domain_id))
                        if not agent_id_from_domain:
                            raise ValueError(f"Domain not found: {domain_id}")
                        agent_id = str(agent_id_from_domain)
                    elif not agent_id:
                        raise ValueError("Either domain_id or agent_id must be provided")
                    
                    params = GetGenerationRunContextAndCreateRunSqlParams(
                        agent_id=uuid.UUID(agent_id),
                        resource_id=uuid.UUID(data["resource_id"]),
                        resource_type=data["resource_type"],
                        profile_id=profile_id,
                        message_ids=message_ids_uuid,
                        department_id=None,  # Can be NULL, modality handlers will get it
                        group_id=uuid.UUID(data["group_id"]) if data.get("group_id") else None,
                        user_instructions=data.get("user_instructions"),
                        developer_message_contentss=data.get("developer_message_contents"),
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

            # Provider-first adapter mapping
            PROVIDER_ADAPTERS = {
                "openai": {
                    "text": OpenAITextAdapter,
                    "image": OpenAIImageAdapter,
                    "video": OpenAIVideoAdapter,
                    "audio": OpenAIAudioAdapter,
                    "call": None,  # Tool calls handled by text adapter
                    "document": None,  # Not yet implemented
                },
                "gemini": {
                    "text": GeminiTextAdapter,
                    "image": GeminiImageAdapter,
                    "video": GeminiVideoAdapter,
                    "audio": GeminiAudioAdapter,
                    "call": None,  # Tool calls handled by text adapter
                    "document": None,  # Not yet implemented
                },
            }

            # Check if multi-modality coordinator is needed
            if output_modalities and should_use_multimodal_coordinator(output_modalities):
                coordinator = MultiModalityCoordinator()
                await coordinator.generate(
                    provider=provider,
                    output_modalities=output_modalities,  # type: ignore
                    sid=sid,
                    data=data,
                    profile_id=profile_id,
                    conn=conn,
                )
                return

            # Get adapter class from provider-first mapping
            provider_adapters = PROVIDER_ADAPTERS.get(provider, {})
            adapter_class = provider_adapters.get(modality)
            
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

            # Create event callbacks
            async def emit_progress(event_type: str, payload: dict[str, Any]) -> None:
                await internal_sio.emit(event_type, payload)

            async def emit_complete(event_type: str, payload: dict[str, Any]) -> None:
                await internal_sio.emit(event_type, payload)

            async def emit_error(event_type: str, payload: dict[str, Any]) -> None:
                await emit_to_internal(
                    event_type,
                    GenerateErrorApiRequest(
                        sid=payload.get("sid", sid),
                        error_message=payload.get("error_message", "Unknown error"),
                        resource_id=payload.get("resource_id"),
                        group_id=payload.get("group_id"),
                        resource_type=payload.get("resource_type", data.get("resource_type", "")),
                    ),
                    sid=sid,
                )

            callbacks = AdapterEventCallbacks(
                emit_progress=emit_progress,
                emit_complete=emit_complete,
                emit_error=emit_error,
            )

            # Prepare adapter config based on modality
            adapter_config: AdapterConfig
            if modality == "text":
                # Convert message_ids to UUID array if provided
                message_ids_uuid = (
                    [uuid.UUID(mid) for mid in message_ids]
                    if message_ids
                    else None
                )
                adapter_config = await prepare_text_config(
                    conn=conn,
                    run_id=uuid.UUID(run_id),
                    agent_id=uuid.UUID(data["agent_id"]),
                    resource_id=uuid.UUID(data["resource_id"]),
                    resource_type=data["resource_type"],
                    message_ids=message_ids_uuid,
                    group_id=uuid.UUID(group_id) if group_id else None,
                )
                # Update with additional data
                adapter_config.department_id = uuid.UUID(data["department_id"]) if data.get("department_id") else None
                adapter_config.resource_id = uuid.UUID(data["resource_id"])
                adapter_config.resource_type = data["resource_type"]
            elif modality == "image":
                image_id_for_config = uuid.UUID(data.get("image_id") or data.get("resource_id"))
                adapter_config = await prepare_image_config(
                    conn=conn,
                    image_id=image_id_for_config,
                    agent_id=uuid.UUID(data["agent_id"]),
                    profile_id=profile_id,
                    department_id=uuid.UUID(data["department_id"]) if data.get("department_id") else None,
                    prompt=data.get("prompt", ""),
                )
            elif modality == "video":
                video_id_for_config = uuid.UUID(data.get("videoId") or data.get("resource_id"))
                # Create upload record first (moved from adapter)
                from app.sql.types import (InsertUploadSqlParams,
                                           InsertUploadSqlRow)
                from utils.sql_helper import load_sql

                # We don't know file size yet, so create with placeholder
                sql_query = load_sql("app/sql/v4/uploads/insert_upload_complete.sql")
                upload_params = InsertUploadSqlParams(
                    file_path="",  # Will be set during persistence
                    mime_type="video/mp4",
                    size=0,  # Will be updated after generation
                )
                upload_result = cast(
                    InsertUploadSqlRow,
                    await execute_sql_typed(conn, sql_query, params=upload_params),
                )
                if not upload_result or not upload_result.id:
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="Failed to create upload record",
                            resource_id=data.get("resource_id"),
                            group_id=group_id,
                            resource_type=data.get("resource_type"),
                        ),
                        sid=sid,
                    )
                    return
                
                upload_id = uuid.UUID(upload_result.id)
                
                adapter_config = await prepare_video_config(
                    conn=conn,
                    video_id=video_id_for_config,
                    profile_id=profile_id,
                    prompt=data.get("prompt", ""),
                    image_reference_id=data.get("imageReferenceId"),
                    upload_id=upload_id,
                )
            elif modality == "audio":
                # Audio uses prepare_audio_config which needs AgentConfig
                from app.socket.v4.artifacts.adapters.base.types import \
                    AgentConfig
                from app.sql.types import (
                    GetAudioRunContextAndCreateRunSqlParams,
                    GetAudioRunContextAndCreateRunSqlRow)

                # Get agent config first
                audio_sql_path = "app/sql/v4/audio/get_audio_run_context_and_create_run_complete.sql"
                # For voice, upload_id is not available, but SQL requires it
                # Use resource_id as upload_id (SQL will handle NULL case)
                upload_id_for_audio = (
                    uuid.UUID(data["resource_id"]) 
                    if data["resource_type"] == "audio" 
                    else uuid.UUID("00000000-0000-0000-0000-000000000000")  # Dummy UUID for voice
                )
                audio_params = GetAudioRunContextAndCreateRunSqlParams(
                    upload_id=upload_id_for_audio,
                    agent_id=uuid.UUID(data["agent_id"]),
                    profile_id=profile_id,
                    department_id=uuid.UUID(data["department_id"]) if data.get("department_id") else None,
                )
                audio_result = cast(
                    GetAudioRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, audio_sql_path, params=audio_params),
                )
                
                if not audio_result:
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="No audio agent configured",
                            resource_id=data.get("resource_id"),
                            group_id=group_id,
                            resource_type=data.get("resource_type"),
                        ),
                        sid=sid,
                    )
                    return
                
                agent_config = AgentConfig(
                    agent_id=audio_result.agent_id or "",
                    agent_name=getattr(audio_result, "agent_name", None),
                    system_prompt=getattr(audio_result, "system_prompt", None),
                    temperature=getattr(audio_result, "temperature", None),
                    reasoning=getattr(audio_result, "reasoning", None),
                    model_id=getattr(audio_result, "model_id", None),
                    model_name=getattr(audio_result, "model_name", None),
                    provider=getattr(audio_result, "provider", None) or "openai",
                    base_url=getattr(audio_result, "base_url", None),
                    api_key=getattr(audio_result, "api_key", None),
                    custom_model=getattr(audio_result, "custom_model", None),
                    provider_id=getattr(audio_result, "provider_id", None),
                    provider_name=getattr(audio_result, "provider_name", None),
                )
                
                adapter_config = await prepare_audio_config(
                    conn=conn,
                    agent_config=agent_config,
                    resource_id=uuid.UUID(data["resource_id"]),
                    resource_type=data["resource_type"],
                    run_id=uuid.UUID(run_id),
                )
            else:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Modality {modality} not yet supported",
                        resource_id=data.get("resource_id"),
                        group_id=group_id,
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )
                return

            # Instantiate and call adapter
            adapter: Any = adapter_class()

            # Handle audio special case - returns AudioSessionConfig
            if modality == "audio":
                if hasattr(adapter, "get_implementation_type") and adapter.get_implementation_type() == "webrtc":
                    # Initialize session using adapter config
                    session_config = await adapter.initialize_session(
                        config=adapter_config,
                        resource_id=uuid.UUID(data["resource_id"]),
                        resource_type=data["resource_type"],
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

            # For text, image, video - call generate_output method with AdapterConfig
            if modality == "text":
                # Update config with resource info for callbacks
                resource_id_str = str(data.get("resource_id")) if data.get("resource_id") else None
                await adapter.generate_output(sid, adapter_config, callbacks)
            elif modality == "image":
                # Image adapter returns ImageGenerationResult
                image_result = await adapter.generate_output(sid, adapter_config, callbacks)
                # Persist image
                if not adapter_config.image_id:
                    raise ValueError("image_id is required")
                image_id: uuid.UUID = adapter_config.image_id  # type: ignore[assignment]
                image_name = data.get("name", "image")
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
                video_result = await adapter.generate_output(sid, adapter_config, callbacks)
                # Persist video
                if not adapter_config.video_id:
                    raise ValueError("video_id is required")
                video_id: uuid.UUID = adapter_config.video_id  # type: ignore[assignment]
                run_id_uuid = uuid.UUID(run_id)
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

