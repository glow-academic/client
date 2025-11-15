"""Simulation WebSocket event handlers."""

import importlib

# Import handlers so they register themselves via @sio.event decorators
# Use importlib for 'continue' since it's a Python keyword
importlib.import_module("app.web.simulations.continue")
from app.web.simulations.send_message import \
    send_simulation_message  # noqa: F401
from app.web.simulations.start import start_simulation  # noqa: F401
from app.web.simulations.stop import stop_simulation  # noqa: F401
