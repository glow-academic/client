"""Attempts resource router."""

from app.api.v4.attempts.archive import router as archive_router
from app.api.v4.attempts.draft import router as draft_router
from app.api.v4.attempts.eval import router as eval_router
from app.api.v4.attempts.simulation import router as simulation_router
from fastapi import APIRouter

router = APIRouter(prefix="/attempts", tags=["attempts"])

# Include endpoint routers
router.include_router(archive_router)
router.include_router(draft_router)
router.include_router(simulation_router)
router.include_router(eval_router)
