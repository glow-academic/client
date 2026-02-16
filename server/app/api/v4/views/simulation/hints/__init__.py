"""Simulation hints view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.hints.get import router as get_router
from app.api.v4.views.simulation.hints.recreate import router as recreate_router
from app.api.v4.views.simulation.hints.refresh import router as refresh_router

router = APIRouter(prefix="/hints", tags=["views", "simulation", "hints"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
