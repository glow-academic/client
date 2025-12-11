"""Simulation voice WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.simulations.voice.debug import simulation_voice_debug_info  # noqa: F401
from app.socket.simulations.voice.start import simulation_voice_start  # noqa: F401
from app.socket.simulations.voice.stop import simulation_voice_stop  # noqa: F401
