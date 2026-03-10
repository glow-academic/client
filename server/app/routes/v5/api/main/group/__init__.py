"""Group artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.group.docs import router as docs_router
from app.routes.v5.api.main.group.export import router as export_router
from app.routes.v5.api.main.group.generate import router as generate_router
from app.routes.v5.api.main.group.get import router as get_router
from app.routes.v5.api.main.group.refresh import router as refresh_router

router = APIRouter(prefix="/group", tags=["artifacts", "group"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(docs_router)
router.include_router(export_router)
# Socket event API equivalents
router.include_router(generate_router)
