"""Eval attempt resource router."""

from fastapi import APIRouter

from app.api.v3.evals.attempt.full import router as full_router

router = APIRouter(prefix="/attempt", tags=["evals", "attempts"])

# Include endpoint routers
router.include_router(full_router)

