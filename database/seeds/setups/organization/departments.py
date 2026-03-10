"""Organization department seed definitions."""

from database.seeds.ids import sid

# ---------------------------------------------------------------------------
# Deterministic IDs
# ---------------------------------------------------------------------------

ORGANIZATION_DEPT = sid("org/department/organization")

# ---------------------------------------------------------------------------
# Department definitions
# ---------------------------------------------------------------------------

departments = [
    dict(
        id=ORGANIZATION_DEPT,
        name="Organization",
        description="Organization department",
    ),
]
