"""Connection WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.connections.connect import connect  # noqa: F401
from app.socket.connections.disconnect import disconnect  # noqa: F401
from app.socket.connections.join_chat import join_chat  # noqa: F401
from app.socket.connections.leave_chat import leave_chat  # noqa: F401
from app.socket.connections.stop_chat import stop_chat  # noqa: F401
