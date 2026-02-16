"""Simulation improvements view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.improvements.get import router as get_router
from app.api.v4.views.simulation.improvements.recreate import router as recreate_router
from app.api.v4.views.simulation.improvements.refresh import router as refresh_router

router = APIRouter(prefix="/improvements", tags=["views", "simulation", "improvements"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
