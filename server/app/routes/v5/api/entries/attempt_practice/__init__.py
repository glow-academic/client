"""AttemptPractice entry endpoints."""

from fastapi import APIRouter

from app.routes.v5.api.entries.attempt_practice.create import router as create_router
from app.routes.v5.api.entries.attempt_practice.search import router as search_router

router = APIRouter()
router.include_router(create_router)
router.include_router(search_router)
