"""Simulation history view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.history.get import router as get_router
from app.api.v4.views.simulation.history.recreate import router as recreate_router
from app.api.v4.views.simulation.history.refresh import router as refresh_router

router = APIRouter(prefix="/history", tags=["views", "simulation", "history"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
