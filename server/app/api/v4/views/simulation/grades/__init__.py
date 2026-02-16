"""Simulation grades view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.grades.get import router as get_router
from app.api.v4.views.simulation.grades.recreate import router as recreate_router
from app.api.v4.views.simulation.grades.refresh import router as refresh_router

router = APIRouter(prefix="/grades", tags=["views", "simulation", "grades"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
