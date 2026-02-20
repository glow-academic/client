"""Client-facing WebSocket event handlers for v5.

Importing this module registers the unified `generate` event with Socket.IO.
"""

from . import generate  # noqa: F401 — registers @sio.event on import
