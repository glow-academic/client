"""OpenAI image generation adapter - handles image generation using litellm."""

import base64
from typing import Any

import httpx

from ....base.config import AdapterConfig, AdapterEventCallbacks
from ....base.output_adapter import BaseOutputAdapter
from ....base.types import ImageGenerationResult

# Try to import litellm, fall back gracefully if not available
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

# Providers that support litellm image generation
LITELLM_SUPPORTED_PROVIDERS = {"openai", "anthropic", "google", "stability-ai"}


class OpenAIImageAdapter(BaseOutputAdapter):
    """OpenAI image generation adapter."""

    async def generate_output(
        self,
        sid: str,
        config: AdapterConfig,
        callbacks: AdapterEventCallbacks,
    ) -> ImageGenerationResult:
        """Generate image - returns unified result type.

        Args:
            sid: Socket ID
            config: AdapterConfig with all necessary data (no database access)
            callbacks: Event callbacks for progress, completion, and error events

        Returns:
            ImageGenerationResult with image_bytes, mime_type, file_size
        """
        image_id = str(config.image_id) if config.image_id else ""
        prompt = config.prompt or ""

        try:
            # Provider-specific image generation logic
            image_bytes = None

            if config.provider in LITELLM_SUPPORTED_PROVIDERS or LITELLM_AVAILABLE:
                if not LITELLM_AVAILABLE:
                    await callbacks.emit_error(
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
                        model=config.model_name,
                        api_key=config.api_key,  # Already decrypted
                        base_url=config.base_url if config.base_url else None,
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
                        await callbacks.emit_error(
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
                            await callbacks.emit_error(
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
                    await callbacks.emit_error(
                        "generate_image_error",
                        {
                            "sid": sid,
                            "image_id": image_id,
                            "error_message": f"Image generation failed: {str(e)}",
                        },
                    )
                    raise
            else:
                await callbacks.emit_error(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": f"Provider {config.provider} not yet supported",
                    },
                )
                raise ValueError(f"Provider {config.provider} not yet supported")

            if not image_bytes:
                await callbacks.emit_error(
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
            await callbacks.emit_error(
                "generate_image_error",
                {
                    "sid": sid,
                    "image_id": image_id,
                    "error_message": f"Unexpected error: {str(e)}",
                },
            )
            raise
