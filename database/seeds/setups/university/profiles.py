"""University profile seed definitions.

Each profile is a dict of primitives that maps directly to CreateProfileItem.
The `id` field is a deterministic UUID so downstream seeds can reference these
profiles by importing the ID constants.

Names are CREATED as new resources.
Role and department IDs reference pre-existing resources (01-resources/).
"""

from uuid import UUID

from database.seeds.ids import sid
from database.seeds.setups.university.departments import UNIVERSITY_DEPT

# ---------------------------------------------------------------------------
# Pre-existing role resource IDs (from database/seeds/resources/roles.py)
# ---------------------------------------------------------------------------

ROLE_ADMIN = UUID("019bbabc-5a36-76d3-8fc3-8415fe308cd3")
ROLE_INSTRUCTIONAL = UUID("019bbabc-5a3b-741e-bad3-474cc6c05fd6")

# ---------------------------------------------------------------------------
# Deterministic IDs — importable by other modules
# ---------------------------------------------------------------------------

UNIVERSITY_ADMIN = sid("uni/profile/university-admin")
PROFESSOR_SMITH = sid("uni/profile/professor-smith")
TA_JOHNSON = sid("uni/profile/ta-johnson")

# ---------------------------------------------------------------------------
# Profile definitions
# ---------------------------------------------------------------------------

profiles = [
    # ── University Admin ─────────────────────────────────────────────────
    dict(
        id=UNIVERSITY_ADMIN,
        name="University Admin",
        department_ids=[UNIVERSITY_DEPT],
        role_ids=[ROLE_ADMIN],
    ),
    # ── Professor Smith ──────────────────────────────────────────────────
    dict(
        id=PROFESSOR_SMITH,
        name="Professor Smith",
        department_ids=[UNIVERSITY_DEPT],
        role_ids=[ROLE_INSTRUCTIONAL],
    ),
    # ── TA Johnson ───────────────────────────────────────────────────────
    dict(
        id=TA_JOHNSON,
        name="TA Johnson",
        department_ids=[UNIVERSITY_DEPT],
        role_ids=[ROLE_INSTRUCTIONAL],
    ),
]
