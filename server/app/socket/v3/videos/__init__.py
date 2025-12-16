"""Video WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.v3.videos.generate import video_generate  # noqa: F401
from app.socket.v3.videos.outline import video_outline  # noqa: F401
