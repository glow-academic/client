"""WebSocket handler for image_generation_complete event."""

from typing import Any

from app.main import get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel

logger = get_logger(__name__)


class ImageGenerationCompletePayload(BaseModel):
    image_id: str
    file_path: str
    mime_type: str
    file_size: int


async def _image_generation_complete_impl(
    sid: str, data: ImageGenerationCompletePayload
) -> None:
    """Handle image generation completion request via WebSocket."""
    image_id = data.image_id
    file_path = data.file_path
    mime_type = data.mime_type
    file_size = data.file_size

    pool = get_pool()
    if not pool:
        logger.error(f"Database pool not available for image completion {image_id}")
        return

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            # Load SQL query at top (DHH style - one SQL file per websocket event)
            sql = load_sql("sql/v3/images/complete_image_generation_complete.sql")
            
            sql_query = sql
            sql_params = (image_id, file_path, mime_type, file_size)
            
            result = await conn.fetchrow(sql, *sql_params)
            
            if not result:
                logger.error(
                    f"Failed to complete image generation for {image_id}"
                )
                return

            upload_id = result["upload_id"]
            logger.info(
                f"✓ Image generation completed: image_id={image_id}, upload_id={upload_id}"
            )

    except Exception as e:
        logger.error(
            f"Error in image generation completion for {image_id}: {e}",
            exc_info=True,
        )


@sio.event  # type: ignore
async def image_generation_complete(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        payload = ImageGenerationCompletePayload(**data)
        await _image_generation_complete_impl(sid, payload)
    except Exception as e:
        logger.error(
            f"Error in image_generation_complete for {sid}: {str(e)}", exc_info=True
        )

