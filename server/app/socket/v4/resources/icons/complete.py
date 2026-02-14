"""Icons resource completion handler."""

import uuid
from typing import Any

from app.api.v4.resources.icons.get import get_icons_internal
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.resources.icons.types import IconsGenerationCompleteEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def handle_complete(data: dict[str, Any]) -> None:
    """Handle icons generation complete - hydrate and emit typed event."""
    sid = data.get("sid", "")
    group_id_str = data.get("group_id", "")
    run_id = data.get("run_id")
    tool_result = data.get("result") or {}
    resource_id_str = tool_result.get("resource_id")

    if not sid or not resource_id_str:
        return

    resource_id = uuid.UUID(resource_id_str)

    try:
        async with get_db_connection() as conn:
            items = await get_icons_internal(conn, [resource_id])
            if not items:
                return
            item = items[0]
            resource_data = (
                item.model_dump(mode="json") if hasattr(item, "model_dump") else {}
            )
    except Exception as e:
        logger.exception(f"Failed to fetch icons/{resource_id}: {e}")
        return

    event = IconsGenerationCompleteEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_id=resource_id_str,
        group_id=group_id_str,
        run_id=run_id,
        id=resource_data.get("id"),
        name=resource_data.get("name"),
        description=resource_data.get("description"),
        value=resource_data.get("value"),
        generated=resource_data.get("generated"),
    )

    await sio.emit(
        "icons_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )
