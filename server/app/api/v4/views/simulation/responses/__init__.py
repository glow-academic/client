"""Simulation responses view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.responses.get import router as get_router
from app.api.v4.views.simulation.responses.recreate import router as recreate_router
from app.api.v4.views.simulation.responses.refresh import router as refresh_router

router = APIRouter(prefix="/responses", tags=["views", "simulation", "responses"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
