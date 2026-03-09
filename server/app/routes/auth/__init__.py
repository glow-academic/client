"""Auth resource router (not available to MCP).

Note: /auth/profile and /auth/settings have been replaced by
POST /artifacts/profiles/context (canonical profile context endpoint).
Only config_router and default_idp_router remain at /auth level.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])

# Note: config_router is mounted separately in server.py (no auth required for discovery)
# Note: default_idp_router moved to root level in main.py (infrastructure-level, not versioned)
