"""Unified attempt detail router (home + practice via practice: bool)."""

from fastapi import APIRouter

from app.routes.v5.api.main.attempt.archive import router as archive_router
from app.routes.v5.api.main.attempt.docs import router as docs_router
from app.routes.v5.api.main.attempt.get import router as get_router

router = APIRouter(prefix="/attempt", tags=["artifacts", "attempt"])

router.include_router(get_router)
router.include_router(archive_router)
router.include_router(docs_router)
