"""Simulations v4 router."""

from fastapi import APIRouter

from app.api.v4.simulations.create import router as create_router
from app.api.v4.simulations.delete import router as delete_router
from app.api.v4.simulations.detail import router as detail_router
from app.api.v4.simulations.duplicate import router as duplicate_router
from app.api.v4.simulations.list import router as list_router
from app.api.v4.simulations.new import router as new_router
from app.api.v4.simulations.update import router as update_router

router = APIRouter(prefix="/simulations", tags=["simulations"])

# Include all simulation endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
