"""Simulation feedbacks view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.feedbacks.get import router as get_router
from app.api.v4.views.simulation.feedbacks.recreate import router as recreate_router
from app.api.v4.views.simulation.feedbacks.refresh import router as refresh_router

router = APIRouter(prefix="/feedbacks", tags=["views", "simulation", "feedbacks"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
