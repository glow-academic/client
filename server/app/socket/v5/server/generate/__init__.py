"""Server layer handlers for generation events.

Routes internal generation_channel events to artifact-specific client events:
- started: {artifact_type}_generation_started (from generation_started)
- progress: {artifact_type}_generation_progress
- complete: {artifact_type}_generation_complete
- saved: {artifact_type}_generation_saved
- error: {artifact_type}_generation_error
- media_progress: {artifact_type}_generation_media_progress
- media_complete: {artifact_type}_generation_media_complete
"""

from . import (  # noqa: F401
    complete,
    error,
    media_complete,
    media_progress,
    progress,
    saved,
    started,
)
