"""Simulation replacements view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.replacements.get import router as get_router
from app.api.v4.views.simulation.replacements.recreate import router as recreate_router
from app.api.v4.views.simulation.replacements.refresh import router as refresh_router

router = APIRouter(prefix="/replacements", tags=["views", "simulation", "replacements"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
