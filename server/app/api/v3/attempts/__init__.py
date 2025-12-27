"""Attempts resource router."""

from fastapi import APIRouter

from app.api.v3.attempts.archive import router as archive_router
from app.api.v3.attempts.eval import router as eval_router
from app.api.v3.attempts.simulation import router as simulation_router

router = APIRouter(prefix="/attempts", tags=["attempts"])

# Include endpoint routers
router.include_router(archive_router)
router.include_router(simulation_router)
router.include_router(eval_router)
