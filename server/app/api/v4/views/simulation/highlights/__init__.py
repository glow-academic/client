"""Simulation highlights view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.highlights.get import router as get_router
from app.api.v4.views.simulation.highlights.recreate import router as recreate_router
from app.api.v4.views.simulation.highlights.refresh import router as refresh_router

router = APIRouter(prefix="/highlights", tags=["views", "simulation", "highlights"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
