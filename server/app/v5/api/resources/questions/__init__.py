"""Questions resources router."""

from fastapi import APIRouter

from app.v5.api.resources.questions.get import router as get_router
from app.v5.api.resources.questions.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
