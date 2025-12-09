"""Simulation voice user WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.simulations.voice.user.text import simulation_voice_user_text  # noqa: F401
