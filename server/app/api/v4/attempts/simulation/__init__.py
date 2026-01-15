"""Simulation attempts router."""

from fastapi import APIRouter

from app.api.v4.attempts.simulation.get import router as get_router
from app.api.v4.attempts.simulation.archive import router as archive_router

router = APIRouter(prefix="/simulation", tags=["attempts", "simulation"])

router.include_router(get_router)
router.include_router(archive_router)
