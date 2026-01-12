"""Simulations v4 router."""

from fastapi import APIRouter

from app.api.v4.simulations.delete import router as delete_router
from app.api.v4.simulations.duplicate import router as duplicate_router
from app.api.v4.simulations.get import router as get_router
from app.api.v4.simulations.list import router as list_router
from app.api.v4.simulations.save import router as save_router

router = APIRouter(prefix="/simulations", tags=["simulations"])

# Include all simulation endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
