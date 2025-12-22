"""Utility functions for generating images from prompts using litellm."""

import os
import uuid
from typing import Any

import asyncpg  # type: ignore
from app.main import UPLOAD_FOLDER
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

# Try to import litellm, fall back gracefully if not available
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    logger.warning("litellm not available - image generation will not work")


async def get_agent_model_info(
    conn: asyncpg.Connection,
    agent_id: str,
    profile_id: str,
) -> dict[str, Any] | None:
    """Get agent's model information for image generation.

    Args:
        conn: Database connection
        agent_id: Agent ID
        profile_id: Profile ID (required for API key resolution)

    Returns:
        Dict with api_key, base_url, model_name, provider, or None if not found
    """
    sql_query = load_sql("sql/v3/agents/get_agent_model_info.sql")

    row = await conn.fetchrow(sql_query, agent_id, profile_id)
    if not row:
        return None

    return {
        "model_name": row["model_name"],
        "provider": row["provider"] or "",
        "base_url": row["base_url"] or None,
        "api_key": row["api_key"],
    }


async def generate_image_from_prompt(
    name: str,
    prompt: str,
    agent_id: str,
    conn: asyncpg.Connection,
    department_id: str | None = None,
    profile_id: str | None = None,
) -> str:
    """Generate an image from a prompt using litellm and save it.

    Args:
        name: Name for the image
        prompt: Detailed prompt for image generation
        agent_id: Agent ID to get model configuration from
        conn: Database connection
        department_id: Optional department ID
        profile_id: Optional profile ID

    Returns:
        Upload ID (UUID as string) of the created upload record

    Raises:
        ValueError: If agent not found, API key missing, or image generation fails
    """
    if not LITELLM_AVAILABLE:
        raise ValueError("litellm is not available - cannot generate images")

    # Get agent's model info (profile_id is required for API key resolution)
    if not profile_id:
        raise ValueError("profile_id is required for image generation")
    model_info = await get_agent_model_info(conn, agent_id, profile_id)
    if not model_info:
        raise ValueError(f"Agent {agent_id} not found or inactive")

    api_key = model_info["api_key"]
    if not api_key:
        raise ValueError(f"API key not found for agent {agent_id}")

    # Decrypt API key
    try:
        decrypted_api_key = decrypt_api_key(api_key)
    except Exception as e:
        raise ValueError(f"Failed to decrypt API key: {str(e)}")

    model_name = model_info["model_name"]
    base_url = model_info["base_url"]
    provider = model_info["provider"]

    # Determine image model - use dall-e-3 by default for OpenAI, or use model_name if it's an image model
    # For now, assume OpenAI providers use dall-e-3, others use their model_name
    image_model = model_name
    if provider.lower() == "openai" and "dall-e" not in model_name.lower():
        # Use dall-e-3 as default for OpenAI if model doesn't specify image model
        image_model = "dall-e-3"

    logger.info(
        f"Generating image with model={image_model}, provider={provider}, "
        f"base_url={base_url or 'default'}"
    )

    # Generate image using litellm
    try:
        response = await litellm.aimage_generation(
            prompt=prompt,
            model=image_model,
            api_key=decrypted_api_key,
            base_url=base_url if base_url else None,
        )

        # Extract image URL or bytes from response
        # litellm returns different formats depending on provider
        image_url = None
        image_bytes = None

        if isinstance(response, dict):
            # OpenAI format: {"data": [{"url": "..."}]} or {"data": [{"b64_json": "..."}]}
            if "data" in response and len(response["data"]) > 0:
                data_item = response["data"][0]
                image_url = data_item.get("url")
                # Some providers return b64_json instead of URL
                if not image_url:
                    b64_json = data_item.get("b64_json")
                    if b64_json:
                        import base64

                        image_bytes = base64.b64decode(b64_json)
        elif isinstance(response, str):
            # Some providers return URL directly
            image_url = response

        if not image_url and not image_bytes:
            raise ValueError("No image data returned from litellm")

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
            raise ValueError("Failed to get image bytes")

    except Exception as e:
        logger.error(f"Image generation failed: {str(e)}", exc_info=True)
        raise ValueError(f"Image generation failed: {str(e)}")

    # Determine file extension (default to png)
    file_ext = ".png"
    # Try to infer from content or use default
    if len(image_bytes) > 0:
        if image_bytes.startswith(b"\x89PNG"):
            file_ext = ".png"
        elif image_bytes.startswith(b"\xff\xd8"):
            file_ext = ".jpg"
        elif image_bytes.startswith(b"GIF"):
            file_ext = ".gif"

    # Generate UUID filename
    upload_uuid = uuid.uuid4()
    file_path = f"{upload_uuid}{file_ext}"
    full_path = UPLOAD_FOLDER / file_path

    # Ensure uploads directory exists
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

    # Save image bytes to file
    with open(full_path, "wb") as f:
        f.write(image_bytes)

    file_size = len(image_bytes)

    # Determine mime type
    mime_type = "image/png"
    if file_ext == ".jpg" or file_ext == ".jpeg":
        mime_type = "image/jpeg"
    elif file_ext == ".gif":
        mime_type = "image/gif"

    # Create upload record
    sql_insert_upload = load_sql("sql/v3/uploads/insert_upload.sql")
    upload_row = await conn.fetchrow(
        sql_insert_upload,
        file_path,
        mime_type,
        file_size,
    )

    if not upload_row:
        # Clean up file if upload record creation failed
        try:
            os.remove(full_path)
        except Exception:
            pass
        raise ValueError("Failed to create upload record")

    upload_id_value = upload_row["id"]
    upload_id_str: str = str(upload_id_value) if upload_id_value else ""
    if not upload_id_str:
        raise ValueError("Failed to get upload ID from database")

    upload_id_uuid = uuid.UUID(upload_id_str)

    # Create image record (without upload_id)
    sql_insert_image = load_sql("sql/v3/images/insert_image_complete.sql")
    image_row = await conn.fetchrow(
        sql_insert_image,
        name,
    )

    if not image_row:
        logger.warning(f"Failed to create image record for upload {upload_id_str}")
        # Don't fail - upload record exists, image can be created later
        return str(upload_id_str)

    image_id_str = image_row["id"]

    # Link image to upload via junction table
    sql_insert_image_upload = load_sql("sql/v3/images/insert_image_upload_complete.sql")
    image_upload_row = await conn.fetchrow(
        sql_insert_image_upload,
        image_id_str,
        upload_id_str,
    )

    if not image_upload_row:
        logger.warning(
            f"Failed to create image_uploads junction record for image {image_id_str}, upload {upload_id_str}"
        )

    logger.info(
        f"✓ Generated image '{name}': image_id={image_id_str}, upload_id={upload_id_str}, "
        f"file_path={file_path}, size={file_size} bytes"
    )

    return str(upload_id_str)
