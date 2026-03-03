"""Auth resource router (not available to MCP)."""

from fastapi import APIRouter

from app.auth.analytics import router as analytics_router
from app.auth.callback import router as callback_router
from app.auth.decrypt import router as decrypt_router
from app.auth.drafts import router as drafts_router
from app.auth.email import router as email_router
from app.auth.emulate import router as emulate_router
from app.auth.generate import router as generate_router
from app.auth.group import router as group_router
from app.auth.login import router as login_router
from app.auth.page import router as page_router
from app.auth.profile import router as profile_router
from app.auth.settings import router as settings_router
from app.auth.simulatable import router as simulatable_router
from app.auth.upsert import router as upsert_router

router = APIRouter(prefix="/auth", tags=["auth"])

# Include all auth endpoint routers
router.include_router(login_router)
router.include_router(profile_router)
router.include_router(settings_router)
router.include_router(page_router)
router.include_router(analytics_router)
router.include_router(drafts_router)
router.include_router(email_router)
router.include_router(generate_router)
router.include_router(group_router)
router.include_router(upsert_router)
router.include_router(simulatable_router)
router.include_router(emulate_router)
router.include_router(callback_router)
router.include_router(decrypt_router)
# Note: default_idp_router moved to root level in main.py (infrastructure-level, not versioned)
