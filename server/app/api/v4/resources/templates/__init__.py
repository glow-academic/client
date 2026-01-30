"""Templates resources router."""

from fastapi import APIRouter

from app.api.v4.resources.templates.get import router as get_router
from app.api.v4.resources.templates.html import router as html_router
from app.api.v4.resources.templates.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(html_router)
router.include_router(search_router)
