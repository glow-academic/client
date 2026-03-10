"""Generation preparation — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client
from app.infra.websocket.generate_prepare_impl import generate_prepare_impl
from app.infra.websocket.socket_event import make_emit
from app.routes.v5.socket.client.registry import REGISTRY

internal_sio = get_internal_sio()


@internal_sio.on("generate_prepare")  # type: ignore
async def generate_prepare_handler_new(data: dict[str, Any]) -> None:
    artifact_types_raw = data.get("artifact_types") or []
    artifact_type = (
        artifact_types_raw[0]["name"]
        if artifact_types_raw and isinstance(artifact_types_raw[0], dict)
        else "unknown"
    )
    artifact_config = REGISTRY.get(artifact_type)
    redis = get_redis_client()
    pool = get_pool()

    async with pool.acquire() as conn:
        await generate_prepare_impl(
            data,
            emit=make_emit(),
            pool=pool,
            conn=conn,
            redis=redis,
            artifact_config=artifact_config,
        )
