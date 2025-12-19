"""Eval attempt resource router."""

from fastapi import APIRouter

from app.api.v3.evals.attempt.full import router as full_router
from app.api.v3.evals.attempt.update import router as update_router

router = APIRouter(prefix="/attempt", tags=["evals", "attempts"])

# Include endpoint routers
router.include_router(full_router)
router.include_router(update_router)
