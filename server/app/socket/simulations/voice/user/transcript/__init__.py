"""Simulation voice user transcript WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.simulations.voice.user.transcript.delta import simulation_voice_user_transcript_delta  # noqa: F401
from app.socket.simulations.voice.user.transcript.done import simulation_voice_user_transcript_done  # noqa: F401

