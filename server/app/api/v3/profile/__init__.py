"""Profile v3 API endpoints."""

from fastapi import APIRouter

from .context import router as context_router
from .detail import router as detail_router
from .email import router as email_router
from .emulate import router as emulate_router
from .simulatable import router as simulatable_router
from .update import router as update_router

router = APIRouter(prefix="/profile", tags=["profile"])

# Include all profile endpoint routers
router.include_router(detail_router)
router.include_router(update_router)
router.include_router(email_router)
router.include_router(context_router)
router.include_router(emulate_router)
router.include_router(simulatable_router)
