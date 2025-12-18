"""Eval attempts resource router."""

from fastapi import APIRouter

from app.api.v3.evals.attempts.list import router as list_router

router = APIRouter(prefix="/attempts", tags=["evals", "attempts"])

# Include endpoint routers
router.include_router(list_router)

