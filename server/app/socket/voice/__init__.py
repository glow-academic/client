"""Voice WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.voice.interrupted import voice_interrupted  # noqa: F401
from app.socket.voice.start_voice import start_voice  # noqa: F401
from app.socket.voice.stop_voice import stop_voice  # noqa: F401
from app.socket.voice.tool_call import voice_tool_call  # noqa: F401
from app.socket.voice.user_message import voice_user_message  # noqa: F401

__all__ = [
    "start_voice",
    "stop_voice",
    "voice_interrupted",
    "voice_tool_call",
    "voice_user_message",
]

