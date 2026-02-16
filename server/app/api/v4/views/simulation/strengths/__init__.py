"""Simulation strengths view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.strengths.get import router as get_router
from app.api.v4.views.simulation.strengths.recreate import router as recreate_router
from app.api.v4.views.simulation.strengths.refresh import router as refresh_router

router = APIRouter(prefix="/strengths", tags=["views", "simulation", "strengths"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
