"""Personas v3 router."""

from app.api.v3.personas.create import router as create_router
from app.api.v3.personas.delete import router as delete_router
from app.api.v3.personas.detail import router as detail_router
from app.api.v3.personas.detail_default import router as detail_default_router
from app.api.v3.personas.duplicate import router as duplicate_router
from app.api.v3.personas.list import router as list_router
from app.api.v3.personas.update import router as update_router
from fastapi import APIRouter

router = APIRouter(prefix="/personas", tags=["personas"])

# Include all persona endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_default_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)

