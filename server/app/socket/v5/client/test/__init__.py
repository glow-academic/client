"""Test client event handlers for v5.

Importing this module registers all test_* events with Socket.IO.
"""

from . import (
    join,  # noqa: F401 — registers @sio.event on import
    leave,  # noqa: F401
)
