"""Pricing and logging WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.pricing.log import log_run  # noqa: F401

