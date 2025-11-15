"""Assistant WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.web.assistants import send_message  # noqa: F401
from app.web.assistants import start  # noqa: F401
from app.web.assistants import stop  # noqa: F401

