"""Quiz WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.quizzes.complete import quiz_complete  # noqa: F401
from app.socket.quizzes.create import quiz_create  # noqa: F401
from app.socket.quizzes.submit_response import quiz_submit_response  # noqa: F401
