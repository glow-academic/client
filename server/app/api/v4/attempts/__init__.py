"""Attempts resource router."""

from fastapi import APIRouter

from app.api.v4.attempts.benchmark import router as benchmark_router
from app.api.v4.attempts.general import router as general_router
from app.api.v4.attempts.practice import router as practice_router
from app.api.v4.attempts.simulation import router as simulation_router

router = APIRouter(prefix="/attempts", tags=["attempts"])

router.include_router(simulation_router)
router.include_router(benchmark_router)
router.include_router(general_router)
router.include_router(practice_router)
