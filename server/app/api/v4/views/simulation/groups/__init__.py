"""Simulation groups view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.groups.get import router as get_router
from app.api.v4.views.simulation.groups.recreate import router as recreate_router
from app.api.v4.views.simulation.groups.refresh import router as refresh_router

router = APIRouter(prefix="/groups", tags=["views", "simulation", "groups"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
