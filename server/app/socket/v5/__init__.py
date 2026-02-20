"""Socket v5 API — unified WebSocket client layer.

Provides a single `generate` event handler that works for ALL draft artifact
types via a registry pattern, replacing the per-artifact `{artifact}_generate`
handlers in v4.
"""

from fastapi import APIRouter

from . import client  # noqa: F401 — registers @sio.event handlers on import

router = APIRouter(prefix="/socket/v5", tags=["socket-v5"])
