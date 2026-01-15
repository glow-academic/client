"""Auth resource router (not available to MCP)."""

from app.api.v4.auth.context import router as context_router
from app.api.v4.auth.email import router as email_router
from app.api.v4.auth.emulate import router as emulate_router
from app.api.v4.auth.login import router as login_router
from app.api.v4.auth.simulatable import router as simulatable_router
from app.api.v4.auth.upsert import router as upsert_router
from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])

# Include all auth endpoint routers
router.include_router(login_router)
router.include_router(context_router)
router.include_router(email_router)
router.include_router(upsert_router)
router.include_router(simulatable_router)
router.include_router(emulate_router)
