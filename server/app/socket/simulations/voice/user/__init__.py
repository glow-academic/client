"""Simulation voice user WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.simulations.voice.user.delta import simulation_voice_user_delta  # noqa: F401
from app.socket.simulations.voice.user.speech import simulation_voice_user_speech  # noqa: F401
from app.socket.simulations.voice.user.start import simulation_voice_user_start  # noqa: F401
from app.socket.simulations.voice.user.text import simulation_voice_user_text  # noqa: F401
from app.socket.simulations.voice.user.transcript import simulation_voice_user_transcript  # noqa: F401
