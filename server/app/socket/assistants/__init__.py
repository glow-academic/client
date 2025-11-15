"""Assistant WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.assistants.send_message import \
    send_assistant_message  # noqa: F401
from app.socket.assistants.start import start_assistant  # noqa: F401
from app.socket.assistants.stop import stop_assistant  # noqa: F401
