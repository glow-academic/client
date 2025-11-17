"""Simulation WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.simulations.continue_chat import \
    continue_simulation  # noqa: F401
from app.socket.simulations.create_practice_scenario import \
    create_practice_scenario  # noqa: F401
from app.socket.simulations.send_message import \
    send_simulation_message  # noqa: F401
from app.socket.simulations.start import start_simulation  # noqa: F401
from app.socket.simulations.stop import stop_simulation  # noqa: F401
