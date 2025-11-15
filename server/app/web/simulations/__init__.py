"""Simulation WebSocket event handlers."""

import importlib

# Import handlers so they register themselves via @sio.event decorators
# Use importlib for 'continue' since it's a Python keyword
importlib.import_module("app.web.simulations.continue")
from app.web.simulations import send_message  # noqa: F401
from app.web.simulations import start  # noqa: F401
from app.web.simulations import stop  # noqa: F401
