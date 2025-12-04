"""Voice WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.voice.realtime_event import voice_realtime_event  # noqa: F401
from app.socket.voice.start_voice import start_voice  # noqa: F401
from app.socket.voice.stop_voice import stop_voice  # noqa: F401

