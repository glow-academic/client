"""Document WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.documents.generate import document_generate  # noqa: F401
