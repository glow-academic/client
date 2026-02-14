"""Parameter fields resource completion handler."""

import uuid
from typing import Any

from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.resources.parameter_fields.types import (
    ParameterFieldsGenerationCompleteEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def handle_complete(data: dict[str, Any]) -> None:
    """Handle parameter_fields generation complete - hydrate and emit typed event."""
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
            items = await get_parameter_fields_internal(conn, [resource_id])
            if not items:
                return
            item = items[0]
            resource_data = (
                item.model_dump(mode="json") if hasattr(item, "model_dump") else {}
            )
    except Exception as e:
        logger.exception(f"Failed to fetch parameter_fields/{resource_id}: {e}")
        return

    event = ParameterFieldsGenerationCompleteEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_id=resource_id_str,
        group_id=group_id_str,
        run_id=run_id,
        id=resource_data.get("id"),
        field_id=resource_data.get("field_id"),
        parameter_id=resource_data.get("parameter_id"),
        name=resource_data.get("name"),
        description=resource_data.get("description"),
        generated=resource_data.get("generated"),
        conditional_parameter_id=resource_data.get("conditional_parameter_id"),
    )

    await sio.emit(
        "parameter_fields_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )
