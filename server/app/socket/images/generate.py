"""WebSocket handler for generate_image event."""

import os
import re
import uuid
from typing import Any

import asyncpg  # type: ignore
from app.main import IMAGE_FOLDER, get_internal_sio, get_pool, sio
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel

logger = get_logger(__name__)
internal_sio = get_internal_sio()

# Try to import litellm, fall back gracefully if not available
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    logger.warning("litellm not available - image generation will not work")


class GenerateImagePayload(BaseModel):
    image_id: str
    name: str
    prompt: str
    agent_id: str
    department_id: str | None = None
    profile_id: str | None = None
    room: str | None = None
    trace_id: str | None = None  # For scenario tool completion events


async def _generate_image_impl(sid: str, data: GenerateImagePayload) -> None:
    """Handle image generation request via WebSocket."""
    image_id = data.image_id
    name = data.name
    prompt = data.prompt
    agent_id = data.agent_id
    department_id = data.department_id
    profile_id = data.profile_id
    room = data.room

    pool = get_pool()
    if not pool:
        logger.error(f"Database pool not available for image {image_id}")
        await _emit_image_error(image_id, room, "Database pool not available")
        return

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            # Load SQL query at top (DHH style - one SQL file per route)
            sql = load_sql("sql/v3/images/get_image_generation_context_and_create_upload.sql")
            
            # Get context + create run atomically
            sql_query = sql
            sql_params = (
                image_id,
                agent_id,
                profile_id,
                department_id,
            )
            
            try:
                context_row = await conn.fetchrow(sql, *sql_params)
            except Exception as e:
                logger.error(
                    f"Failed to get context and create run for image {image_id}: {str(e)}",
                    exc_info=True,
                )
                await _emit_image_error(
                    image_id, room, f"Failed to initialize image generation: {str(e)}"
                )
                return
            
            if not context_row:
                await _emit_image_error(
                    image_id, room, f"Agent {agent_id} not found or inactive"
                )
                return

            api_key = context_row["api_key"]
            if not api_key:
                await _emit_image_error(
                    image_id, room, f"API key not found for agent {agent_id}"
                )
                return

            # Decrypt API key
            try:
                decrypted_api_key = decrypt_api_key(api_key)
            except Exception as e:
                await _emit_image_error(
                    image_id, room, f"Failed to decrypt API key: {str(e)}"
                )
                return

            model_name = context_row["model_name"]
            base_url = context_row["base_url"]
            provider = context_row["provider"]
            run_id = context_row["run_id"]

            # Determine image model
            image_model = model_name
            if provider.lower() == "openai" and "dall-e" not in model_name.lower():
                image_model = "dall-e-3"

            logger.info(
                f"Image generation started: image_id={image_id}, "
                f"model={image_model}, provider={provider}, run_id={run_id}"
            )

            # Emit progress event
            await _emit_image_progress(
                image_id, room, "generating", "Generating image..."
            )

            # Generate image using litellm
            if not LITELLM_AVAILABLE:
                await _emit_image_error(
                    image_id, room, "litellm is not available"
                )
                return

            try:
                response = await litellm.aimage_generation(
                    prompt=prompt,
                    model=image_model,
                    api_key=decrypted_api_key,
                    base_url=base_url if base_url else None,
                )

                # Extract image URL or bytes from response
                image_url = None
                image_bytes = None

                if isinstance(response, dict):
                    if "data" in response and len(response["data"]) > 0:
                        data_item = response["data"][0]
                        image_url = data_item.get("url")
                        if not image_url:
                            b64_json = data_item.get("b64_json")
                            if b64_json:
                                import base64

                                image_bytes = base64.b64decode(b64_json)
                elif isinstance(response, str):
                    image_url = response

                if not image_url and not image_bytes:
                    await _emit_image_error(
                        image_id, room, "No image data returned from litellm"
                    )
                    return

                # Download image if URL provided
                if image_url and not image_bytes:
                    try:
                        import httpx

                        async with httpx.AsyncClient() as client:
                            image_response = await client.get(image_url)
                            image_response.raise_for_status()
                            image_bytes = image_response.content
                    except ImportError:
                        # Fallback to requests if httpx not available
                        import requests  # type: ignore

                        requests_response = requests.get(image_url)  # type: ignore
                        requests_response.raise_for_status()  # type: ignore
                        image_bytes = requests_response.content  # type: ignore

                if not image_bytes:
                    await _emit_image_error(
                        image_id, room, "Failed to get image bytes"
                    )
                    return

            except Exception as e:
                logger.error(
                    f"Image generation failed for {image_id}: {e}", exc_info=True
                )
                await _emit_image_error(
                    image_id, room, f"Image generation failed: {str(e)}"
                )
                return

            # Determine file extension and mime type
            file_ext = ".png"
            mime_type = "image/png"
            if len(image_bytes) > 0:
                if image_bytes.startswith(b"\x89PNG"):
                    file_ext = ".png"
                    mime_type = "image/png"
                elif image_bytes.startswith(b"\xff\xd8"):
                    file_ext = ".jpg"
                    mime_type = "image/jpeg"
                elif image_bytes.startswith(b"GIF"):
                    file_ext = ".gif"
                    mime_type = "image/gif"

            # Create deduplicated filename from image name
            # Sanitize name: remove special chars, replace spaces with underscores, lowercase
            safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", name)
            safe_name = re.sub(r"_+", "_", safe_name).strip("_")
            safe_name = safe_name.lower() or "image"
            
            # Append UUID for deduplication
            upload_uuid = uuid.uuid4()
            file_name = f"{safe_name}_{upload_uuid}{file_ext}"
            file_path = f"image/{file_name}"
            full_path = IMAGE_FOLDER / file_name

            # Ensure image directory exists
            IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)

            # Save image bytes to file
            with open(full_path, "wb") as f:
                f.write(image_bytes)

            file_size = len(image_bytes)

            logger.info(
                f"✓ Image generated: image_id={image_id}, "
                f"file_path={file_path}, size={file_size} bytes"
            )

            # Call log_run via internal bus (similar to scenario generation)
            # Note: Image generation via litellm doesn't provide token counts,
            # so we pass 0 tokens. The run was already created in the SQL query.
            await internal_sio.emit(
                "log_run",
                {
                    "runId": run_id,
                    "operationType": "image",
                    "inputTextTokens": 0,  # Image generation doesn't use text tokens
                    "outputTextTokens": 0,  # Image generation doesn't output text
                    "systemPrompt": None,
                    "inputItems": None,
                    "assistantOutput": None,
                    "departmentId": str(department_id) if department_id else None,
                },
            )

            # Emit completion event to internal bus to trigger completion handler
            await internal_sio.emit(
                "image_generation_complete",
                {
                    "image_id": image_id,
                    "file_path": file_path,
                    "mime_type": mime_type,
                    "file_size": file_size,
                    "room": room,  # Preserve room for client emission
                    "trace_id": data.trace_id,  # Preserve trace_id for scenario tool completion
                },
            )

    except Exception as e:
        logger.error(
            f"Error in image generation for {image_id}: {e}",
            exc_info=True,
        )
        await _emit_image_error(image_id, room, f"Unexpected error: {str(e)}")


async def _emit_image_progress(
    image_id: str,
    room: str | None,
    progress_type: str,
    message: str | None = None,
) -> None:
    """Emit WebSocket event for image generation progress."""
    from app.socket.scenarios.generate import (
        ScenarioImageGenerationProgressPayload,
        scenario_image_generation_progress)

    if not room:
        logger.warning(
            f"No room specified for image {image_id}, cannot emit WebSocket event"
        )
        return

    await scenario_image_generation_progress(
        ScenarioImageGenerationProgressPayload(
            type=progress_type,
            message=message,
            image_id=image_id,
        ),
        room=room,
    )


async def _emit_image_error(
    image_id: str,
    room: str | None,
    error_message: str,
) -> None:
    """Emit WebSocket event for image generation error."""
    from app.socket.scenarios.generate import (
        ScenarioImageGenerationErrorPayload, scenario_image_generation_error)

    if not room:
        logger.warning(
            f"No room specified for image {image_id}, cannot emit WebSocket event"
        )
        return

    # Update image record: mark as completed (even on error) to prevent retries
    pool = get_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                sql_update_image = load_sql("sql/v3/images/update_image_completed.sql")
                await conn.execute(sql_update_image, image_id, True)
        except Exception as e:
            logger.error(f"Failed to update image record on error: {e}")

    await scenario_image_generation_error(
        ScenarioImageGenerationErrorPayload(
            success=False,
            image_id=image_id,
            message=error_message,
        ),
        room=room,
    )


@sio.event  # type: ignore
async def generate_image(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler (client-to-server)."""
    try:
        payload = GenerateImagePayload(**data)
        await _generate_image_impl(sid, payload)
    except Exception as e:
        logger.error(f"Error in generate_image for {sid}: {str(e)}", exc_info=True)
        # Try to emit error if we have image_id
        if isinstance(data, dict) and "image_id" in data:
            image_id = data["image_id"]
            room = data.get("room")
            await _emit_image_error(image_id, room, f"Invalid request: {str(e)}")


@internal_sio.on("generate_image")
async def generate_image_internal(data: dict[str, Any]) -> None:
    """Handle generate_image event from internal bus (server-to-server)."""
    # Extract room from payload (it's passed as "room" not "sid")
    room = data.get("room")
    if not room:
        logger.error("[generate_image_internal] Missing 'room' in payload")
        return
    
    try:
        payload = GenerateImagePayload(**data)
        await _generate_image_impl(room, payload)  # Use room as sid for internal calls
    except Exception as e:
        logger.error(f"Error in generate_image_internal: {str(e)}", exc_info=True)
        # Try to emit error if we have image_id
        if isinstance(data, dict) and "image_id" in data:
            image_id = data["image_id"]
            await _emit_image_error(image_id, room, f"Invalid request: {str(e)}")
