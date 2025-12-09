"""Simulation WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.simulations.join import simulation_join  # noqa: F401
from app.socket.simulations.leave import simulation_leave  # noqa: F401
