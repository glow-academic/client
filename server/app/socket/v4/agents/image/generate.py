"""WebSocket handler for generate_image event."""

import re
import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import IMAGE_FOLDER, get_internal_sio, sio
from app.sql.types import (
    GetImageGenerationContextAndCreateUploadSqlParams,
    GetImageGenerationContextAndCreateUploadSqlRow,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/images/get_image_generation_context_and_create_upload_complete.sql"

# Try to import litellm, fall back gracefully if not available
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False


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
    profile_id_from_payload = data.profile_id
    room = data.room or sid

    # Get profile_id from sid lookup (O(1) Redis lookup) if not provided in payload
    # Image generation can be called from scenario tool which may pass profile_id
    if not profile_id_from_payload:
        profile_id_str = await find_profile_by_socket(sid)
        profile_id = uuid.UUID(profile_id_str) if profile_id_str else None
    else:
        profile_id = uuid.UUID(profile_id_from_payload) if profile_id_from_payload else None

    try:
        async with get_db_connection() as conn:
            # Get context + create run atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetImageGenerationContextAndCreateUploadSqlParams(
                    image_id=uuid.UUID(image_id),
                    agent_id=uuid.UUID(agent_id),
                    profile_id=profile_id,  # Can be None
                    department_id=uuid.UUID(department_id) if department_id else None,
                )
                result = cast(
                    GetImageGenerationContextAndCreateUploadSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                await _emit_image_error(
                    image_id, room, f"Failed to initialize image generation: {str(e)}"
                )
                return

            if not result:
                await _emit_image_error(
                    image_id, room, f"Agent {agent_id} not found or inactive"
                )
                return

            api_key = result.api_key
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

            model_name = result.model_name
            base_url = result.base_url
            provider = result.provider
            run_id = result.run_id

            # Use model_name directly from database (set via image_agent_id)
            # The SQL query already returns the correct model_name based on the agent's model_id
            image_model = model_name
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
                    else:
                        # Truncate response for logging (avoid base64 mess)
                        response_str = str(response)
                        truncated_response = (
                            response_str[:500] + "...[truncated]"
                            if len(response_str) > 500
                            else response_str
                        )
                elif isinstance(response, str):
                    image_url = response
                else:
                    # Truncate response for logging (avoid base64 mess)
                    response_str = str(response)
                    truncated_response = (
                        response_str[:500] + "...[truncated]"
                        if len(response_str) > 500
                        else response_str
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
                    await _emit_image_error(
                        image_id, room, error_msg, trace_id=data.trace_id
                    )
                    return

                # Download image if URL provided
                if image_url and not image_bytes:
                    try:
                        import httpx

                        timeout = httpx.Timeout(30.0, connect=10.0)
                        async with httpx.AsyncClient(timeout=timeout) as client:
                            image_response = await client.get(image_url)
                            image_response.raise_for_status()
                            image_bytes = image_response.content
                    except Exception as download_error:
                        error_msg = (
                            f"Failed to download image from URL for {image_id}: "
                            f"{str(download_error)}. URL: {image_url}, "
                            f"Exception type: {type(download_error).__name__}"
                        )
                        await _emit_image_error(
                            image_id, room, error_msg, trace_id=data.trace_id
                        )
                        return

                if not image_bytes:
                    error_msg = (
                        f"Failed to get image bytes for {image_id}. "
                        f"image_url={image_url}, image_bytes={image_bytes}"
                    )
                    await _emit_image_error(
                        image_id, room, error_msg, trace_id=data.trace_id
                    )
                    return

            except Exception as e:
                error_msg = (
                    f"Image generation failed for {image_id}: {str(e)}. "
                    f"Exception type: {type(e).__name__}"
                )
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


            # Ensure image directory exists
            IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)

            # Save image bytes to file
            try:
                with open(full_path, "wb") as f:
                    f.write(image_bytes)
            except Exception as write_error:
                error_msg = (
                    f"Failed to write image file for {image_id}: {str(write_error)}. "
                    f"full_path={full_path}, IMAGE_FOLDER={IMAGE_FOLDER}, "
                    f"Exception type: {type(write_error).__name__}"
                )
                await _emit_image_error(
                    image_id, room, error_msg, trace_id=data.trace_id
                )
                return

            file_size = len(image_bytes)


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

    from app.socket.v4.agents.scenario.generate import (
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
        return

    # Update image record: mark as completed (even on error) to prevent retries
    try:
        async with get_db_connection() as conn:
            sql_update_image = load_sql(
                "app/sql/v4/images/update_image_completed.sql"
            )
            await conn.execute(sql_update_image, image_id, True)
    except Exception:
        pass

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

    from app.socket.v4.agents.scenario.generate import (
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
        return

    try:
        payload = GenerateImagePayload(**data)
        await _generate_image_impl(room, payload)  # Use room as sid for internal calls
    except Exception as e:
        # Try to emit error if we have image_id
        if isinstance(data, dict) and "image_id" in data:
            image_id = data["image_id"]
            await _emit_image_error(image_id, room, f"Invalid request: {str(e)}")


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def generate_image_api(request: GenerateImagePayload) -> dict[str, bool]:
    """Client-to-server event: Generate an image."""
    return {"success": True}
