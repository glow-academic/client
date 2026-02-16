"""Simulation analyses view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.analyses.get import router as get_router
from app.api.v4.views.simulation.analyses.recreate import router as recreate_router
from app.api.v4.views.simulation.analyses.refresh import router as refresh_router

router = APIRouter(prefix="/analyses", tags=["views", "simulation", "analyses"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
