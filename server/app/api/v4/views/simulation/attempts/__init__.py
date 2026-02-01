"""Simulation attempts view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.attempts.get import router as get_router
from app.api.v4.views.simulation.attempts.recreate import router as recreate_router
from app.api.v4.views.simulation.attempts.refresh import router as refresh_router

router = APIRouter(prefix="/attempts", tags=["views", "simulation", "attempts"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
