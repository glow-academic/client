"""Problem statements resources router."""

from fastapi import APIRouter

from app.routes.v5.api.resources.problem_statements.get import router as get_router
from app.routes.v5.api.resources.problem_statements.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
