"""Personas v4 router."""

from fastapi import APIRouter

from app.api.v4.personas.delete import router as delete_router
from app.api.v4.personas.draft import router as draft_router
from app.api.v4.personas.duplicate import router as duplicate_router
from app.api.v4.personas.get import router as get_router
from app.api.v4.personas.list import router as list_router
from app.api.v4.personas.save import router as save_router

router = APIRouter(prefix="/personas", tags=["personas"])

# Include all persona endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
