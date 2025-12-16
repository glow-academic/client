"""Video WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

from .generate import router as generate_router

router = APIRouter(prefix="/videos", tags=["socket-client"])

router.include_router(generate_router)
