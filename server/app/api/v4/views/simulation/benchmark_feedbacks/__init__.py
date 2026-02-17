"""Simulation test_feedback view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.test_feedback.get import router as get_router
from app.api.v4.views.simulation.test_feedback.recreate import (
    router as recreate_router,
)
from app.api.v4.views.simulation.test_feedback.refresh import (
    router as refresh_router,
)

router = APIRouter(
    prefix="/test_feedback", tags=["views", "simulation", "test_feedback"]
)

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
