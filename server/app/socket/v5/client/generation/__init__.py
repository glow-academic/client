"""Client-side generation socket handlers.

Keeps generation entrypoints grouped by logical call, mirroring the API
operation layout while preserving the shared client/internal/server split.
"""

from . import generate  # noqa: F401
