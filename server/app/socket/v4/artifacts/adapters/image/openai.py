"""OpenAI image generation adapter - handles image generation using litellm."""

import base64
import uuid
from typing import Any, cast

import httpx
from app.main import get_internal_sio
from app.sql.types import (GetImageGenerationContextAndCreateUploadSqlParams,
                           GetImageGenerationContextAndCreateUploadSqlRow)
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed

from ..base import ImageGenerationResult
from ..persistence import persist_image
from .base import BaseImageAdapter

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


class OpenAIImageAdapter(BaseImageAdapter):
    """OpenAI image generation adapter."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> ImageGenerationResult:
        """Generate image - returns unified result type.

        Args:
            sid: Socket ID
            data: Request data containing image_id, name, prompt, agent_id, etc.
            profile_id: Profile ID (optional)
            conn: Database connection

        Returns:
            ImageGenerationResult with image_bytes, mime_type, file_size
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
                raise

            if not result:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Agent {agent_id} not found or inactive",
                    },
                )
                raise ValueError(f"Agent {agent_id} not found or inactive")

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
                raise ValueError(f"API key not found for agent {agent_id}")

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
                raise

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
                    raise ValueError("litellm is not available")

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
                        raise ValueError(
                            f"No image data returned from litellm for image {image_id}"
                        )

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
                            raise

                except Exception as e:
                    await internal_sio.emit(
                        "generate_image_error",
                        {
                            "sid": sid,
                            "image_id": image_id,
                            "error_message": f"Image generation failed: {str(e)}",
                        },
                    )
                    raise
            else:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Provider {provider} not yet supported",
                    },
                )
                raise ValueError(f"Provider {provider} not yet supported")

            if not image_bytes:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Failed to get image bytes for {image_id}",
                    },
                )
                raise ValueError(f"Failed to get image bytes for {image_id}")

            # Determine mime type
            mime_type = "image/png"
            if len(image_bytes) > 0:
                if image_bytes.startswith(b"\x89PNG"):
                    mime_type = "image/png"
                elif image_bytes.startswith(b"\xff\xd8"):
                    mime_type = "image/jpeg"
                elif image_bytes.startswith(b"GIF"):
                    mime_type = "image/gif"

            # Return unified result type
            return ImageGenerationResult(
                image_bytes=image_bytes,
                mime_type=mime_type,
                file_size=len(image_bytes),
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
            raise

