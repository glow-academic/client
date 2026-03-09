"""Auth resource router (not available to MCP)."""

from fastapi import APIRouter

from app.routes.auth.decrypt import router as decrypt_router
from app.routes.auth.email import router as email_router
from app.routes.auth.emulate import router as emulate_router
from app.routes.auth.generate import router as generate_router

from app.routes.auth.profile import router as profile_router
from app.routes.auth.settings import router as settings_router
from app.routes.auth.simulatable import router as simulatable_router
from app.routes.auth.upsert import router as upsert_router

router = APIRouter(prefix="/auth", tags=["auth"])

# Include all auth endpoint routers
router.include_router(profile_router)
router.include_router(settings_router)
router.include_router(email_router)
router.include_router(generate_router)

router.include_router(upsert_router)
router.include_router(simulatable_router)
router.include_router(emulate_router)
router.include_router(decrypt_router)
# Note: config_router is mounted separately in server.py (no auth required for discovery)
# Note: default_idp_router moved to root level in main.py (infrastructure-level, not versioned)
