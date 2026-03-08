"""Invocation artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.invocation.docs import router as docs_router
from app.routes.v5.api.main.invocation.draft import router as draft_router
from app.routes.v5.api.main.invocation.export import router as export_router
from app.routes.v5.api.main.invocation.get import router as get_router
from app.routes.v5.api.main.invocation.refresh import router as refresh_router

router = APIRouter(prefix="/invocation", tags=["invocation"])
router.include_router(get_router)
router.include_router(draft_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)
