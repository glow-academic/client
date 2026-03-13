"""Unified token factory — thin socket handler.

Business logic lives in app.infra.websocket.generate_artifact_impl.
"""

from __future__ import annotations

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.generate_artifact_impl import generate_artifact_impl
from app.infra.websocket.generation_types import (
    GenerateArtifactPayload,
    GenerateErrorApiRequest,
)

# Re-exported from infra — canonical location is app.infra.websocket.generation_types
from app.infra.websocket.generation_types import (
    ModelConfig as ModelConfig,
)
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_artifact")  # type: ignore
async def generate_artifact_internal(data: dict[str, Any]) -> None:
    """Handle generate_artifact event from internal bus (server-to-server)."""
    sid = data.get("sid", "")
    if not sid:
        return
    try:
        payload = GenerateArtifactPayload(**data)
    except Exception as e:
        await internal_sio.emit(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid generate_artifact payload: {str(e)}",
                artifact_type=data.get("artifact_type"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ).model_dump(),
        )
        return

    profile_id = await find_profile_by_socket(sid)
    await generate_artifact_impl(
        payload,
        emit=make_emit(),
        sid=sid,
        profile_id=profile_id,
    )
