"""Personas v4 router."""

from fastapi import APIRouter

from app.api.v4.personas.create import router as create_router
from app.api.v4.personas.delete import router as delete_router
from app.api.v4.personas.detail import router as detail_router
from app.api.v4.personas.duplicate import router as duplicate_router
from app.api.v4.personas.list import router as list_router
from app.api.v4.personas.new import router as new_router
from app.api.v4.personas.update import router as update_router

router = APIRouter(prefix="/personas", tags=["personas"])

# Include all persona endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
