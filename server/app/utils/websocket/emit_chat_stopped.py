"""Emit chat_stopped event to the appropriate room."""

from app.main import get_sio_instance


async def emit_chat_stopped(
    chat_id: str, chat_type: str, message: str = "Chat stopped successfully"
) -> None:
    """Emit chat_stopped event to the appropriate room"""
    sio = get_sio_instance()
    await sio.emit(
        "chat_stopped",
        {"chat_id": chat_id, "chat_type": chat_type, "message": message},
        room=f"{chat_type}_{chat_id}",
    )

