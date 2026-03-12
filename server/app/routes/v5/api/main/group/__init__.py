"""Group artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.group.audio import router as audio_router
from app.routes.v5.api.main.group.call import router as call_router
from app.routes.v5.api.main.group.docs import router as docs_router
from app.routes.v5.api.main.group.export import router as export_router
from app.routes.v5.api.main.group.file import router as file_router
from app.routes.v5.api.main.group.get import router as get_router
from app.routes.v5.api.main.group.image import router as image_router
from app.routes.v5.api.main.group.refresh import router as refresh_router
from app.routes.v5.api.main.group.text import router as text_router
from app.routes.v5.api.main.group.video import router as video_router

router = APIRouter(prefix="/group", tags=["artifacts", "group"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(docs_router)
router.include_router(export_router)

# Download modality routers
router.include_router(audio_router)
router.include_router(call_router)
router.include_router(file_router)
router.include_router(image_router)
router.include_router(text_router)
router.include_router(video_router)
