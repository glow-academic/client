"""Activity artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.activity.get import router as get_router
from app.api.v4.artifacts.activity.problem import router as problem_router
from app.api.v4.artifacts.activity.refresh import router as refresh_router
from app.api.v4.artifacts.activity.resolve import router as resolve_router

router = APIRouter()
router.include_router(get_router)
router.include_router(problem_router)
router.include_router(refresh_router)
router.include_router(resolve_router)
