"""Simulation text WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.v3.simulations.text.end import \
    simulation_text_end  # noqa: F401
from app.socket.v3.simulations.text.next import \
    simulation_text_next  # noqa: F401
from app.socket.v3.simulations.text.practice import \
    simulation_text_practice  # noqa: F401
from app.socket.v3.simulations.text.send import \
    simulation_text_send  # noqa: F401
from app.socket.v3.simulations.text.start import \
    simulation_text_start  # noqa: F401
from app.socket.v3.simulations.text.stop import \
    simulation_text_stop  # noqa: F401
