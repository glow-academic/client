"""Unified attempt detail router (home + practice via practice: bool)."""

from fastapi import APIRouter

from app.routes.v5.api.main.attempt.archive import router as archive_router
from app.routes.v5.api.main.attempt.audio import router as audio_router
from app.routes.v5.api.main.attempt.docs import router as docs_router
from app.routes.v5.api.main.attempt.end import router as end_router
from app.routes.v5.api.main.attempt.end_all import router as end_all_router
from app.routes.v5.api.main.attempt.events import router as events_router
from app.routes.v5.api.main.attempt.export import router as export_router
from app.routes.v5.api.main.attempt.get import router as get_router
from app.routes.v5.api.main.attempt.grade import router as grade_router
from app.routes.v5.api.main.attempt.message import router as message_router
from app.routes.v5.api.main.attempt.next import router as next_router
from app.routes.v5.api.main.attempt.refresh import router as refresh_router
from app.routes.v5.api.main.attempt.response import router as response_router
from app.routes.v5.api.main.attempt.search import router as search_router
from app.routes.v5.api.main.attempt.start import router as start_router
from app.routes.v5.api.main.attempt.stop import router as stop_router
from app.routes.v5.api.main.attempt.use_previous import router as use_previous_router

router = APIRouter(prefix="/attempt", tags=["artifacts", "attempt"])

router.include_router(get_router)
router.include_router(archive_router)
router.include_router(refresh_router)
router.include_router(docs_router)
router.include_router(export_router)
# Socket event API equivalents
router.include_router(start_router)
router.include_router(next_router)
router.include_router(end_router)
router.include_router(end_all_router)
router.include_router(message_router)
router.include_router(grade_router)
router.include_router(stop_router)
router.include_router(response_router)
router.include_router(use_previous_router)
router.include_router(audio_router)
router.include_router(events_router)
router.include_router(search_router)
