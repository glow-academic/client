"""Agents resource router."""

from fastapi import APIRouter

from app.api.v4.agents.create import router as create_router
from app.api.v4.agents.delete import router as delete_router
from app.api.v4.agents.detail import router as detail_router
from app.api.v4.agents.draft import router as draft_router
from app.api.v4.agents.duplicate import router as duplicate_router
from app.api.v4.agents.list import router as list_router
from app.api.v4.agents.new import router as new_router
from app.api.v4.agents.update import router as update_router

router = APIRouter(prefix="/agents", tags=["agents"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
