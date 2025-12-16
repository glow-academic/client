"""Scenario WebSocket event handlers - client-to-server."""

from fastapi import APIRouter

from .generate import router as generate_router
from .regenerate import router as regenerate_router
from .tools import router as tools_router

router = APIRouter(prefix="/scenarios", tags=["socket-client"])

router.include_router(generate_router)
router.include_router(regenerate_router)
router.include_router(tools_router)
