"""Client-facing WebSocket event handlers for v5.

Importing this module registers all client events with Socket.IO:
- connect / disconnect (lifecycle)
- generate (unified draft generation)
- attempt_* (attempt room management)
- test_* (test room management)
"""

from . import (
    attempt,  # noqa: F401 — registers attempt_* events
    connect,  # noqa: F401 — registers connect/disconnect
    generate,  # noqa: F401 — registers generate event
    test,  # noqa: F401 — registers test_* events
)
