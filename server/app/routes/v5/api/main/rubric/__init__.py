"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.routes.v5.api.main.rubric.create import router as create_router
from app.routes.v5.api.main.rubric.delete import router as delete_router
from app.routes.v5.api.main.rubric.docs import router as docs_router
from app.routes.v5.api.main.rubric.draft import router as draft_router
from app.routes.v5.api.main.rubric.duplicate import router as duplicate_router
from app.routes.v5.api.main.rubric.get import router as get_router
from app.routes.v5.api.main.rubric.save import router as save_router
from app.routes.v5.api.main.rubric.search import router as search_router
from app.routes.v5.api.main.rubric.update import router as update_router

router = APIRouter(prefix="/rubrics", tags=["rubrics"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(search_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)
