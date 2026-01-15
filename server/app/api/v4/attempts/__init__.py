"""Attempts resource router."""

from fastapi import APIRouter

from app.api.v4.attempts.simulation import router as simulation_router
from app.api.v4.attempts.benchmark import router as benchmark_router

router = APIRouter(prefix="/attempts", tags=["attempts"])

router.include_router(simulation_router)
router.include_router(benchmark_router)
