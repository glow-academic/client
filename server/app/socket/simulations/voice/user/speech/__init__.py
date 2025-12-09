"""Simulation voice user speech WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.simulations.voice.user.speech.start import simulation_voice_speech_start  # noqa: F401
from app.socket.simulations.voice.user.speech.done import simulation_voice_speech_done  # noqa: F401
