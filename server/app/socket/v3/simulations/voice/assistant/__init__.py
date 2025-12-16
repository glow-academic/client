"""Simulation voice assistant WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.v3.simulations.voice.assistant.delta import \
    simulation_voice_assistant_delta  # noqa: F401
from app.socket.v3.simulations.voice.assistant.done import \
    simulation_voice_assistant_done  # noqa: F401
from app.socket.v3.simulations.voice.assistant.interrupted import \
    simulation_voice_assistant_interrupted  # noqa: F401
