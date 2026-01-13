"""Agents resource router."""

from fastapi import APIRouter

from app.api.v4.agents.delete import router as delete_router
from app.api.v4.agents.duplicate import router as duplicate_router
from app.api.v4.agents.get import router as get_router
from app.api.v4.agents.list import router as list_router
from app.api.v4.agents.save import router as save_router

router = APIRouter(prefix="/agents", tags=["agents"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
