"""Attempt client event handlers for v5.

Importing this module registers all attempt_* events with Socket.IO.
"""

from . import (
    join,  # noqa: F401 — registers @sio.event on import
    leave,  # noqa: F401
)
