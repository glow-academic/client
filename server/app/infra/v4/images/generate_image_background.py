"""Background task for generating images from prompts using litellm."""

import os
import uuid

from utils.auth.decrypt_api_key import decrypt_api_key
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.main import UPLOAD_FOLDER, get_pool

logger = get_logger(__name__)

# Try to import litellm, fall back gracefully if not available
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    logger.warning("litellm not available - image generation will not work")


async def generate_image_background(
    image_id: str,
    storage_key: str,
) -> None:
    """Background task to generate image, save it, and emit WebSocket event.

    Args:
        image_id: Image ID (UUID as string)
        storage_key: Storage key for retrieving context
    """
    from app.main import get_image_generation_storage

    pool = get_pool()
    if not pool:
        logger.error(f"Database pool not available for image {image_id}")
        await _emit_image_error(image_id, storage_key, "Database pool not available")
        return

    try:
        # Get context from storage
        storage = get_image_generation_storage()
        name = await storage.get(storage_key, "name")
        prompt = await storage.get(storage_key, "prompt")
        agent_id = await storage.get(storage_key, "agent_id")
        department_id = await storage.get(storage_key, "department_id")
        profile_id = await storage.get(storage_key, "profile_id")
        room = await storage.get(storage_key, "room")

        if not name or not prompt or not agent_id:
            await _emit_image_error(
                image_id, storage_key, "Missing required context for image generation"
            )
            return

        async with pool.acquire() as conn:
            # Get agent's model info inline (profile_id is required for API key resolution)
            if not profile_id:
                await _emit_image_error(
                    image_id, storage_key, "profile_id is required for image generation"
                )
                return

            sql_query = load_sql("app/sql/v4/agents/get_agent_model_info.sql")
            row = await conn.fetchrow(sql_query, agent_id, profile_id)
            if not row:
                await _emit_image_error(
                    image_id, storage_key, f"Agent {agent_id} not found or inactive"
                )
                return

            api_key = row["api_key"]
            if not api_key:
                await _emit_image_error(
                    image_id, storage_key, f"API key not found for agent {agent_id}"
                )
                return

            # Decrypt API key
            try:
                decrypted_api_key = decrypt_api_key(api_key)
            except Exception as e:
                await _emit_image_error(
                    image_id, storage_key, f"Failed to decrypt API key: {str(e)}"
                )
                return

            model_name = row["model_name"]
            base_url = row["base_url"]
            provider = row["provider"] or ""

            # Determine image model
            image_model = model_name
            if provider.lower() == "openai" and "dall-e" not in model_name.lower():
                image_model = "dall-e-3"

            logger.info(
                f"Background image generation started: image_id={image_id}, "
                f"model={image_model}, provider={provider}"
            )

            # Generate image using litellm
            if not LITELLM_AVAILABLE:
                await _emit_image_error(
                    image_id, storage_key, "litellm is not available"
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
                        image_id, storage_key, "No image data returned from litellm"
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
                        image_id, storage_key, "Failed to get image bytes"
                    )
                    return

            except Exception as e:
                logger.error(
                    f"Image generation failed for {image_id}: {e}", exc_info=True
                )
                await _emit_image_error(
                    image_id, storage_key, f"Image generation failed: {str(e)}"
                )
                return

            # Determine file extension
            file_ext = ".png"
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
            sql_insert_upload = load_sql("app/sql/v4/uploads/insert_upload.sql")
            upload_row = await conn.fetchrow(
                sql_insert_upload,
                file_path,
                mime_type,
                file_size,
            )

            if not upload_row:
                await _emit_image_error(
                    image_id, storage_key, "Failed to create upload record"
                )
                # Clean up file
                try:
                    os.remove(full_path)
                except Exception:
                    pass
                return

            upload_id_str = str(upload_row["id"])

            # Link image to upload via junction table
            sql_insert_image_upload = load_sql(
                "app/sql/v4/images/insert_image_upload_complete.sql"
            )
            image_upload_row = await conn.fetchrow(
                sql_insert_image_upload,
                image_id,
                upload_id_str,
            )

            if not image_upload_row:
                logger.warning(
                    f"Failed to create image_uploads junction record for image {image_id}, upload {upload_id_str}"
                )
                # Don't fail - upload exists, can be linked later

            # Update image record: completed=true
            sql_update_image = load_sql("app/sql/v4/images/update_image_completed.sql")
            await conn.execute(sql_update_image, image_id, True)

            logger.info(
                f"✓ Background image generation completed: image_id={image_id}, "
                f"upload_id={upload_id_str}, file_path={file_path}, size={file_size} bytes"
            )

            # Emit WebSocket completion event
            await _emit_image_complete(
                image_id=image_id,
                upload_id=upload_id_str,
                name=name,
                room=room,
            )

            # Clean up storage
            await storage.delete(storage_key, "image_id")
            await storage.delete(storage_key, "name")
            await storage.delete(storage_key, "prompt")
            await storage.delete(storage_key, "agent_id")
            await storage.delete(storage_key, "department_id")
            await storage.delete(storage_key, "profile_id")
            await storage.delete(storage_key, "room")

    except Exception as e:
        logger.error(
            f"Error in background image generation for {image_id}: {e}",
            exc_info=True,
        )
        await _emit_image_error(image_id, storage_key, f"Unexpected error: {str(e)}")


async def _emit_image_complete(
    image_id: str,
    upload_id: str,
    name: str,
    room: str | None,
) -> None:
    """Emit WebSocket event for image generation completion."""
    from app.socket.v4.agents.scenario.generate import (
        ScenarioImageGenerationCompletePayload,
        scenario_image_generation_complete,
    )

    if not room:
        logger.warning(
            f"No room specified for image {image_id}, cannot emit WebSocket event"
        )
        return

    await scenario_image_generation_complete(
        ScenarioImageGenerationCompletePayload(
            success=True,
            image_id=image_id,
            upload_id=upload_id,
            name=name,
        ),
        room=room,
    )


async def _emit_image_error(
    image_id: str,
    storage_key: str,
    error_message: str,
) -> None:
    """Emit WebSocket event for image generation error."""
    from app.main import get_image_generation_storage
    from app.socket.v4.agents.scenario.generate import (
        ScenarioImageGenerationErrorPayload,
        scenario_image_generation_error,
    )

    # Get room from storage
    storage = get_image_generation_storage()
    room = await storage.get(storage_key, "room")

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
                    "app/sql/v4/images/update_image_completed.sql"
                )
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
