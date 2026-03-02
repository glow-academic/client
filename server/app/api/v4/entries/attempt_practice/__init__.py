"""AttemptPractice entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.attempt_practice.create import router as create_router

router = APIRouter()
router.include_router(create_router)
