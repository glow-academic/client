"""Test client event handlers for v5.

Importing this module registers all test_* events with Socket.IO.
"""

from . import (
    end,  # noqa: F401 — registers @sio.event on import
    join,  # noqa: F401
    leave,  # noqa: F401
    run,  # noqa: F401
    start,  # noqa: F401
    stop,  # noqa: F401
)
