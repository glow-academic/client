"""Connection WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.web.connections.connect import connect  # noqa: F401
from app.web.connections.disconnect import disconnect  # noqa: F401
from app.web.connections.join_chat import join_chat  # noqa: F401
from app.web.connections.leave_chat import leave_chat  # noqa: F401
from app.web.connections.stop_chat import stop_chat  # noqa: F401

