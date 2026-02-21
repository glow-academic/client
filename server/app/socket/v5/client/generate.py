"""Client-facing generate handler.

Validates the client payload and emits to the internal "generate" event.
All business logic lives in v5/internal/generate.py.
"""

from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import GeneratePayload
from app.socket.v5.types import GenerateErrorApiRequest
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


@sio.event  # type: ignore
async def generate(sid: str, data: dict[str, Any]) -> None:
    """Handle unified ``generate`` event (client-to-server).

    Validates payload and emits to internal bus for processing.
    """
    artifact_type = data.get("artifact_type", "unknown")
    try:
        payload = GeneratePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await _emit_error(
                sid,
                "Profile not found. Please reconnect.",
                artifact_type,
            )
            return

        await internal_sio.emit(
            "generate",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                **payload.model_dump(mode="json"),
            },
        )
    except Exception as e:
        await _emit_error(
            sid,
            f"Invalid request: {str(e)}",
            artifact_type,
        )
