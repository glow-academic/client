"""Internal generate handler.

Handles: @internal_sio.on("generate") — server-to-server generation dispatch.
Delegates to the shared _generate_impl in v5/client/generate.py.
"""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.socket.v5.client.generate import _generate_impl
from app.socket.v5.client.types import GeneratePayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _emit_error(
    sid: str,
    message: str,
    artifact_type: str,
) -> None:
    """Emit a generation error via the internal bus."""
    await emit_to_internal(
        "generate_call_error",
        GenerateErrorApiRequest(
            sid=sid,
            error_message=message,
            artifact_type=artifact_type,
            resource_type=artifact_type,
        ),
        sid=sid,
    )


@internal_sio.on("generate")  # type: ignore
async def generate_internal(data: dict[str, Any]) -> None:
    """Handle ``generate`` event from internal bus (server-to-server)."""
    artifact_type = data.get("artifact_type", "unknown")
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await _emit_error(
                sid,
                "Profile not found. Please reconnect.",
                artifact_type,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GeneratePayload(**data)
        await _generate_impl(sid, payload, profile_id)
    except Exception as e:
        await _emit_error(
            sid,
            f"Invalid request: {str(e)}",
            artifact_type,
        )
