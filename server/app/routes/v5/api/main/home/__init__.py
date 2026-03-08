"""Home artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.home.docs import router as docs_router
from app.routes.v5.api.main.home.export import router as export_router
from app.routes.v5.api.main.home.get import router as get_router
from app.routes.v5.api.main.home.search import router as search_router
from app.routes.v5.api.main.home.refresh import router as refresh_router

router = APIRouter(prefix="/home", tags=["artifacts", "home"])

router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)
