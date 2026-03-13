"""Test client event handlers for v5.

Importing this module registers all test_* events with Socket.IO.
"""

from . import (
    end,  # noqa: F401 — registers @sio.event on import
    end_all,  # noqa: F401
    group,  # noqa: F401
    join,  # noqa: F401
    leave,  # noqa: F401
    next,  # noqa: F401
    run,  # noqa: F401
    start,  # noqa: F401
    stop,  # noqa: F401
)
