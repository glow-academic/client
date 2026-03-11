"""Module 06 — Auth seed definitions.

Each dict maps directly to CreateAuthItem fields.
String fields (name, description, slug, protocol, active_flag) are resolved
by the _impl function via resolve_auth_values.
"""

from uuid import UUID

# ---------------------------------------------------------------------------
# Deterministic IDs — importable by other modules
# ---------------------------------------------------------------------------

GOOGLE_AUTH = UUID("019b3be4-3117-7aa4-aa34-0041aa51d1d8")
MICROSOFT_AUTH = UUID("019b3be4-3117-7afc-8d1d-a2815d70f294")

# ---------------------------------------------------------------------------
# Auth definitions
# ---------------------------------------------------------------------------

auths = [
    dict(
        id=GOOGLE_AUTH,
        name="Google",
        description="Google Workspace",
        slug="google",
        protocol="google",
        active_flag=True,
    ),
    dict(
        id=MICROSOFT_AUTH,
        name="Microsoft",
        description="Microsoft Entra ID OAuth configuration",
        slug="microsoft",
        protocol="oidc",
        active_flag=True,
    ),
]
