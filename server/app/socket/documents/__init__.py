"""Document WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.documents.generate_template import (
    generate_document_template,  # noqa: F401
)
