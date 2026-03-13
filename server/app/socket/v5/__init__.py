"""Socket v5 — unified WebSocket client + internal layer.

Provides a single `generate` event handler that works for ALL draft artifact
types via a registry pattern, replacing the per-artifact `{artifact}_generate`
handlers in v4.

OpenAPI schema for socket event types is auto-derived from EVENT_REGISTRY
and exposed under ``/v5/events/schema/`` — no dummy routes here.
"""

from . import client, internal, server  # noqa: F401 — registers handlers on import
