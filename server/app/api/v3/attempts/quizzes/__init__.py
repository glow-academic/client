"""Quizzes resource router."""

from fastapi import APIRouter

from app.api.v3.attempts.quizzes.complete import router as complete_router
from app.api.v3.attempts.quizzes.create import router as create_router
from app.api.v3.attempts.quizzes.submit_response import router as submit_response_router

router = APIRouter(prefix="/quizzes", tags=["attempts", "quizzes"])

# Include endpoint routers
router.include_router(create_router)
router.include_router(submit_response_router)
router.include_router(complete_router)

