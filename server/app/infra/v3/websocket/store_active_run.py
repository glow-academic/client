"""Store an active run for potential cancellation."""

import uuid

from app.infra.v3.websocket.set_active_run import set_active_run


async def store_active_run(chat_id: str, run_result: object) -> None:
    """Store an active run for potential cancellation"""
    # Generate a unique run ID for cooperative cancellation
    run_id = str(uuid.uuid4())
    await set_active_run(chat_id, run_id)
