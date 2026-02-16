"""Simulation contents view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.contents.get import router as get_router
from app.api.v4.views.simulation.contents.recreate import router as recreate_router
from app.api.v4.views.simulation.contents.refresh import router as refresh_router

router = APIRouter(prefix="/contents", tags=["views", "simulation", "contents"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
