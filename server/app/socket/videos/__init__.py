"""Video WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.videos.generate_outline import \
    generate_video_outline  # noqa: F401
from app.socket.videos.generate_video import \
    generate_video  # noqa: F401

