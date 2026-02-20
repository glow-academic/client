"""Attempt client event handlers for v5.

Importing this module registers all attempt_* events with Socket.IO.
"""

from . import (
    end,  # noqa: F401 — registers @sio.event on import
    end_all,  # noqa: F401
    join,  # noqa: F401
    leave,  # noqa: F401
    start,  # noqa: F401
    use_previous,  # noqa: F401
)
