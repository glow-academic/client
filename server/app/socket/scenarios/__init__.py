"""Scenario WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.scenarios.generate_ai import \
    generate_scenario_ai  # noqa: F401
from app.socket.scenarios.regenerate import \
    regenerate_scenario  # noqa: F401

