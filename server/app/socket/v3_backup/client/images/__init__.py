"""Image WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

router = APIRouter(prefix="/images", tags=["socket-client"])

# Note: Image handlers are internal-only (triggered by scenario generation)
# They don't have public client-to-server endpoints
