"""Simulation benchmark_feedbacks view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.benchmark_feedbacks.get import router as get_router
from app.api.v4.views.simulation.benchmark_feedbacks.recreate import (
    router as recreate_router,
)
from app.api.v4.views.simulation.benchmark_feedbacks.refresh import (
    router as refresh_router,
)

router = APIRouter(
    prefix="/benchmark_feedbacks", tags=["views", "simulation", "benchmark_feedbacks"]
)

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
