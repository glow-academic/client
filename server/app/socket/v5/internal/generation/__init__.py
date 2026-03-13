"""Internal generation workflow socket handlers.

This package groups the generation workflow by operation instead of leaving the
pipeline spread across the top-level internal socket namespace.
"""

from . import (  # noqa: F401
    generate,
    generate_artifact,
    generate_prepare,
    generation_ended,
    generation_error,
    generation_progress,
)
