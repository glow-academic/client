"""WebSocket handler for generate_image event."""

import re
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.main import IMAGE_FOLDER, get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Try to import litellm, fall back gracefully if not available
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    logger.warning("litellm not available - image generation will not work")


class GenerateImagePayload(BaseModel):
    """Request to generate an image."""

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
    room = data.room or sid

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
            sql = load_sql(
                "app/sql/v3/images/get_image_generation_context_and_create_upload.sql"
            )

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

            # Use model_name directly from database (set via image_agent_id)
            # The SQL query already returns the correct model_name based on the agent's model_id
            image_model = model_name

            logger.info(
                f"Image generation started: image_id={image_id}, "
                f"agent_id={agent_id}, model={image_model}, provider={provider}, run_id={run_id}"
            )

            # Emit progress event
            await _emit_image_progress(
                image_id,
                room,
                "generating",
                "Generating image...",
                trace_id=data.trace_id,
            )

            # Generate image using litellm
            if not LITELLM_AVAILABLE:
                await _emit_image_error(image_id, room, "litellm is not available")
                return

            try:
                logger.info(
                    f"Calling litellm.aimage_generation for image {image_id}: "
                    f"model={image_model}, prompt_length={len(prompt)}, "
                    f"has_api_key={bool(decrypted_api_key)}, has_base_url={bool(base_url)}"
                )
                response = await litellm.aimage_generation(
                    prompt=prompt,
                    model=image_model,
                    api_key=decrypted_api_key,
                    base_url=base_url if base_url else None,
                )

                logger.info(
                    f"litellm.aimage_generation response for image {image_id}: "
                    f"type={type(response)}, "
                    f"is_dict={isinstance(response, dict)}, "
                    f"is_str={isinstance(response, str)}, "
                    f"response_keys={list(response.keys()) if isinstance(response, dict) else 'N/A'}"
                )

                # Extract image URL or bytes from response
                image_url = None
                image_bytes = None

                if isinstance(response, dict):
                    logger.info(
                        f"Processing dict response for image {image_id}: "
                        f"has_data_key={'data' in response}, "
                        f"data_type={type(response.get('data'))}, "
                        f"data_length={len(response.get('data', [])) if isinstance(response.get('data'), list) else 'N/A'}"
                    )
                    if "data" in response and len(response["data"]) > 0:
                        data_item = response["data"][0]
                        logger.info(
                            f"Processing data item for image {image_id}: "
                            f"keys={list(data_item.keys()) if isinstance(data_item, dict) else 'N/A'}, "
                            f"has_url={'url' in data_item if isinstance(data_item, dict) else False}, "
                            f"has_b64_json={'b64_json' in data_item if isinstance(data_item, dict) else False}"
                        )
                        image_url = data_item.get("url")
                        if not image_url:
                            b64_json = data_item.get("b64_json")
                            if b64_json:
                                import base64

                                image_bytes = base64.b64decode(b64_json)
                                logger.info(
                                    f"Decoded base64 image for {image_id}: "
                                    f"bytes_length={len(image_bytes)}"
                                )
                    else:
                        # Truncate response for logging (avoid base64 mess)
                        response_str = str(response)
                        truncated_response = (
                            response_str[:500] + "...[truncated]"
                            if len(response_str) > 500
                            else response_str
                        )
                        logger.warning(
                            f"No data array in response for image {image_id}: "
                            f"response={truncated_response}"
                        )
                elif isinstance(response, str):
                    logger.info(
                        f"Processing string response for image {image_id}: "
                        f"length={len(response)}, "
                        f"is_url_like={response.startswith('http')}"
                    )
                    image_url = response
                else:
                    # Truncate response for logging (avoid base64 mess)
                    response_str = str(response)
                    truncated_response = (
                        response_str[:500] + "...[truncated]"
                        if len(response_str) > 500
                        else response_str
                    )
                    logger.warning(
                        f"Unexpected response type for image {image_id}: "
                        f"type={type(response)}, response={truncated_response}"
                    )

                if not image_url and not image_bytes:
                    # Truncate response for logging (avoid base64 mess)
                    response_str = str(response)
                    truncated_response = (
                        response_str[:500] + "...[truncated]"
                        if len(response_str) > 500
                        else response_str
                    )
                    error_msg = (
                        f"No image data returned from litellm for image {image_id}. "
                        f"Response type: {type(response)}, "
                        f"Response: {truncated_response}"
                    )
                    logger.error(error_msg)
                    await _emit_image_error(
                        image_id, room, error_msg, trace_id=data.trace_id
                    )
                    return

                # Download image if URL provided
                if image_url and not image_bytes:
                    logger.info(
                        f"Downloading image from URL for {image_id}: {image_url}"
                    )
                    try:
                        import httpx

                        timeout = httpx.Timeout(30.0, connect=10.0)
                        async with httpx.AsyncClient(timeout=timeout) as client:
                            image_response = await client.get(image_url)
                            image_response.raise_for_status()
                            image_bytes = image_response.content
                            logger.info(
                                f"Successfully downloaded image for {image_id}: "
                                f"bytes_length={len(image_bytes)}, "
                                f"content_type={image_response.headers.get('content-type')}"
                            )
                    except Exception as download_error:
                        error_msg = (
                            f"Failed to download image from URL for {image_id}: "
                            f"{str(download_error)}. URL: {image_url}, "
                            f"Exception type: {type(download_error).__name__}"
                        )
                        logger.error(error_msg, exc_info=True)
                        await _emit_image_error(
                            image_id, room, error_msg, trace_id=data.trace_id
                        )
                        return

                if not image_bytes:
                    error_msg = (
                        f"Failed to get image bytes for {image_id}. "
                        f"image_url={image_url}, image_bytes={image_bytes}"
                    )
                    logger.error(error_msg)
                    await _emit_image_error(
                        image_id, room, error_msg, trace_id=data.trace_id
                    )
                    return

            except Exception as e:
                error_msg = (
                    f"Image generation failed for {image_id}: {str(e)}. "
                    f"Exception type: {type(e).__name__}"
                )
                logger.error(error_msg, exc_info=True)
                await _emit_image_error(
                    image_id, room, error_msg, trace_id=data.trace_id
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

            logger.info(
                f"Preparing to save image {image_id}: "
                f"IMAGE_FOLDER={IMAGE_FOLDER}, "
                f"file_name={file_name}, "
                f"full_path={full_path}, "
                f"image_bytes_length={len(image_bytes) if image_bytes else 0}"
            )

            # Ensure image directory exists
            IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)
            logger.info(
                f"[IMAGE_DIR_CHECK] image_id={image_id}, trace_id={data.trace_id}, "
                f"IMAGE_FOLDER={IMAGE_FOLDER}, exists={IMAGE_FOLDER.exists()}"
            )

            # Save image bytes to file
            try:
                with open(full_path, "wb") as f:
                    f.write(image_bytes)
                logger.info(
                    f"[IMAGE_SAVE_SUCCESS] image_id={image_id}, trace_id={data.trace_id}, "
                    f"full_path={full_path}, file_exists={full_path.exists()}, "
                    f"file_size={len(image_bytes)} bytes"
                )
            except Exception as write_error:
                error_msg = (
                    f"Failed to write image file for {image_id}: {str(write_error)}. "
                    f"full_path={full_path}, IMAGE_FOLDER={IMAGE_FOLDER}, "
                    f"Exception type: {type(write_error).__name__}"
                )
                logger.error(error_msg, exc_info=True)
                await _emit_image_error(
                    image_id, room, error_msg, trace_id=data.trace_id
                )
                return

            file_size = len(image_bytes)

            logger.info(
                f"[IMAGE_GEN_COMPLETE] image_id={image_id}, trace_id={data.trace_id}, "
                f"file_path={file_path}, size={file_size} bytes, "
                f"full_path={full_path}, file_exists={full_path.exists()}"
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
        await _emit_image_error(
            image_id, room, f"Unexpected error: {str(e)}", trace_id=data.trace_id
        )


async def _emit_image_progress(
    image_id: str,
    room: str | None,
    progress_type: str,
    message: str | None = None,
    trace_id: str | None = None,
) -> None:
    """Emit WebSocket event for image generation progress."""
    if not room:
        logger.warning(
            f"No room specified for image {image_id}, cannot emit WebSocket event"
        )
        return

    if not trace_id:
        await sio.emit(
            "images_generation_progress",
            {
                "type": progress_type,
                "message": message,
                "image_id": image_id,
            },
            room=room,
        )
        return

    from app.socket.v3.agents.scenario.generate import (
        ScenarioImageGenerationProgressPayload,
        scenario_image_generation_progress,
    )

    await scenario_image_generation_progress(
        ScenarioImageGenerationProgressPayload(
            type=progress_type,
            message=message,
            image_id=image_id,
            trace_id=trace_id,
        ),
        room=room,
    )


async def _emit_image_error(
    image_id: str,
    room: str | None,
    error_message: str,
    trace_id: str | None = None,
) -> None:
    """Emit WebSocket event for image generation error."""
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
                sql_update_image = load_sql(
                    "app/sql/v3/images/update_image_completed.sql"
                )
                await conn.execute(sql_update_image, image_id, True)
        except Exception as e:
            logger.error(f"Failed to update image record on error: {e}")

    if not trace_id:
        await sio.emit(
            "images_generation_error",
            {
                "success": False,
                "image_id": image_id,
                "message": error_message,
            },
            room=room,
        )
        return

    from app.socket.v3.agents.scenario.generate import (
        ScenarioImageGenerationErrorPayload,
        scenario_image_generation_error,
    )

    await scenario_image_generation_error(
        ScenarioImageGenerationErrorPayload(
            success=False,
            image_id=image_id,
            message=error_message,
            trace_id=trace_id,
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


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def generate_image_api(request: GenerateImagePayload) -> dict[str, bool]:
    """Client-to-server event: Generate an image."""
    return {"success": True}
