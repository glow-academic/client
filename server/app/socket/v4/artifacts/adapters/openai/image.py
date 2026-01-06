"""OpenAI image generation adapter - handles image generation using litellm."""

import base64
import re
import uuid
from typing import Any, cast

import httpx
from app.main import IMAGE_FOLDER, get_internal_sio
from app.sql.types import (GetImageGenerationContextAndCreateUploadSqlParams,
                           GetImageGenerationContextAndCreateUploadSqlRow)
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

SQL_PATH = (
    "app/sql/v4/images/get_image_generation_context_and_create_upload_complete.sql"
)

# Try to import litellm, fall back gracefully if not available
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

# Providers that support litellm image generation
LITELLM_SUPPORTED_PROVIDERS = {"openai", "anthropic", "google", "stability-ai"}


class OpenAIImageAdapter:
    """OpenAI image generation adapter."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> None:
        """Generate image using OpenAI/litellm.

        Args:
            sid: Socket ID
            data: Request data containing image_id, name, prompt, agent_id, etc.
            profile_id: Profile ID (optional)
            conn: Database connection
        """
        image_id = data.get("image_id", "")
        name = data.get("name", "")
        prompt = data.get("prompt", "")
        agent_id = data.get("agent_id", "")
        department_id = data.get("department_id")

        try:
            # Get context + create run atomically
            try:
                params = GetImageGenerationContextAndCreateUploadSqlParams(
                    image_id=uuid.UUID(image_id),
                    agent_id=uuid.UUID(agent_id),
                    profile_id=profile_id,
                    department_id=uuid.UUID(department_id) if department_id else None,
                )
                result = cast(
                    GetImageGenerationContextAndCreateUploadSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Failed to initialize image generation: {str(e)}",
                    },
                )
                return

            if not result:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Agent {agent_id} not found or inactive",
                    },
                )
                return

            api_key = result.api_key
            if not api_key:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"API key not found for agent {agent_id}",
                    },
                )
                return

            # Decrypt API key
            try:
                decrypted_api_key = decrypt_api_key(api_key)
            except Exception as e:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Failed to decrypt API key: {str(e)}",
                    },
                )
                return

            model_name = result.model_name
            base_url = result.base_url
            provider = result.provider
            run_id = result.run_id

            # Provider-specific image generation logic
            image_bytes = None

            if provider in LITELLM_SUPPORTED_PROVIDERS or LITELLM_AVAILABLE:
                if not LITELLM_AVAILABLE:
                    await internal_sio.emit(
                        "generate_image_error",
                        {
                            "sid": sid,
                            "image_id": image_id,
                            "error_message": "litellm is not available",
                        },
                    )
                    return

                try:
                    response = await litellm.aimage_generation(
                        prompt=prompt,
                        model=model_name,
                        api_key=decrypted_api_key,
                        base_url=base_url if base_url else None,
                    )

                    # Extract image URL or bytes from response
                    image_url = None

                    if isinstance(response, dict):
                        if "data" in response and len(response["data"]) > 0:
                            data_item = response["data"][0]
                            image_url = data_item.get("url")
                            if not image_url:
                                b64_json = data_item.get("b64_json")
                                if b64_json:
                                    image_bytes = base64.b64decode(b64_json)
                    elif isinstance(response, str):
                        image_url = response

                    if not image_url and not image_bytes:
                        await internal_sio.emit(
                            "generate_image_error",
                            {
                                "sid": sid,
                                "image_id": image_id,
                                "error_message": (
                                    f"No image data returned from litellm for image {image_id}"
                                ),
                            },
                        )
                        return

                    # Download image if URL provided
                    if image_url and not image_bytes:
                        try:
                            timeout = httpx.Timeout(30.0, connect=10.0)
                            async with httpx.AsyncClient(timeout=timeout) as client:
                                image_response = await client.get(image_url)
                                image_response.raise_for_status()
                                image_bytes = image_response.content
                        except Exception as download_error:
                            await internal_sio.emit(
                                "generate_image_error",
                                {
                                    "sid": sid,
                                    "image_id": image_id,
                                    "error_message": (
                                        f"Failed to download image from URL: {str(download_error)}"
                                    ),
                                },
                            )
                            return

                except Exception as e:
                    await internal_sio.emit(
                        "generate_image_error",
                        {
                            "sid": sid,
                            "image_id": image_id,
                            "error_message": f"Image generation failed: {str(e)}",
                        },
                    )
                    return
            else:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Provider {provider} not yet supported",
                    },
                )
                return

            if not image_bytes:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Failed to get image bytes for {image_id}",
                    },
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
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Failed to write image file: {str(write_error)}",
                    },
                )
                return

            file_size = len(image_bytes)

            # Emit async pricing event (non-blocking)
            await internal_sio.emit(
                "log_run",
                {
                    "run_id": run_id,
                    "operation_type": "image",
                    "input_text_tokens": 0,
                    "output_text_tokens": 0,
                    "system_prompt": None,
                    "input_items": None,
                    "assistant_output": None,
                    "department_id": str(department_id) if department_id else None,
                },
            )

            # Emit completion event to internal bus
            await internal_sio.emit(
                "generate_image_complete",
                {
                    "sid": sid,
                    "image_id": image_id,
                    "file_path": file_path,
                    "mime_type": mime_type,
                    "file_size": file_size,
                    "trace_id": data.get("trace_id"),  # Preserve trace_id for scenario tool completion
                },
            )

        except Exception as e:
            await internal_sio.emit(
                "generate_image_error",
                {
                    "sid": sid,
                    "image_id": image_id,
                    "error_message": f"Unexpected error: {str(e)}",
                },
            )

