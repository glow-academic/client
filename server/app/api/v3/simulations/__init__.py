"""Simulations v3 router."""

from app.api.v3.simulations.create import router as create_router
from app.api.v3.simulations.delete import router as delete_router
from app.api.v3.simulations.detail import router as detail_router
from app.api.v3.simulations.detail_default import router as detail_default_router
from app.api.v3.simulations.duplicate import router as duplicate_router
from app.api.v3.simulations.list import router as list_router
from app.api.v3.simulations.update import router as update_router
from fastapi import APIRouter

router = APIRouter(prefix="/simulations", tags=["simulations"])

# Include all simulation endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_default_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)

