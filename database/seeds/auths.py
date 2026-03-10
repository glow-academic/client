"""Module 06 — Auth seed definitions.

Each dict maps directly to CreateAuthItem fields.
String fields (name, description, active_flag) are resolved by the _impl function.

Note: slug_id, protocol_ids, and item_ids are ID-only fields and not included
here. These can be added via update after initial creation if needed.
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
        active_flag=True,
    ),
    dict(
        id=MICROSOFT_AUTH,
        name="Microsoft",
        description="Microsoft Entra ID OAuth configuration",
        active_flag=True,
    ),
]
