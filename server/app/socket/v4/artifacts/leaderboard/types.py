"""WebSocket-specific types for leaderboard generation.

Extends base artifact types with leaderboard-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class LeaderboardGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: leaderboard_generation_complete."""

    artifact_type: str = "leaderboard"


class LeaderboardGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: leaderboard_generation_progress."""

    artifact_type: str = "leaderboard"


class LeaderboardGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: leaderboard_generation_error."""

    artifact_type: str = "leaderboard"
