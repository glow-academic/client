"""Voice WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.voice.debug_info import voice_debug_info  # noqa: F401
from app.socket.voice.interrupted import voice_interrupted  # noqa: F401
from app.socket.voice.response_done import voice_response_done  # noqa: F401
from app.socket.voice.speech_started import voice_speech_started  # noqa: F401
from app.socket.voice.start_voice import start_voice  # noqa: F401
from app.socket.voice.stop_voice import stop_voice  # noqa: F401
from app.socket.voice.tool_call_delta import \
    voice_tool_call_delta  # noqa: F401
from app.socket.voice.tool_call_done import voice_tool_call_done  # noqa: F401
from app.socket.voice.transcript_ready import \
    voice_transcript_ready  # noqa: F401
from app.socket.voice.user_message import voice_user_message  # noqa: F401

__all__ = [
    "start_voice",
    "stop_voice",
    "voice_debug_info",
    "voice_interrupted",
    "voice_response_done",
    "voice_speech_started",
    "voice_tool_call_delta",
    "voice_tool_call_done",
    "voice_transcript_ready",
    "voice_user_message",
]

