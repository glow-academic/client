"""Server layer handlers for generation events.

Routes internal generation_channel events to artifact-specific client events:
- started: {artifact_type}_generation_started (from generation_started)
- progress: {artifact_type}_generation_progress
- complete: {artifact_type}_generation_complete
- saved: {artifact_type}_generation_saved
- error: {artifact_type}_generation_error
"""

from . import (  # noqa: F401
    complete,
    error,
    progress,
    saved,
    started,
)
