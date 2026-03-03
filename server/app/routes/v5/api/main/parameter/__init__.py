"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.routes.v5.api.main.parameter.delete import router as delete_router
from app.routes.v5.api.main.parameter.docs import router as docs_router
from app.routes.v5.api.main.parameter.draft import router as draft_router
from app.routes.v5.api.main.parameter.duplicate import router as duplicate_router
from app.routes.v5.api.main.parameter.get import router as get_router
from app.routes.v5.api.main.parameter.list import router as list_router
from app.routes.v5.api.main.parameter.save import router as save_router

router = APIRouter(prefix="/parameters", tags=["parameters"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)
