"""University department seed definitions.

Each department is a dict mapping directly to CreateDepartmentItem.
Names and descriptions are CREATED as new resources.
"""

from database.seeds.ids import sid

# ---------------------------------------------------------------------------
# Deterministic IDs — importable by other modules for department_ids linking
# ---------------------------------------------------------------------------

UNIVERSITY_DEPT = sid("uni/department/university")

# ---------------------------------------------------------------------------
# Department definitions
# ---------------------------------------------------------------------------

departments = [
    dict(
        id=UNIVERSITY_DEPT,
        name="University",
        description="Innovative base of knowledge in the emerging field of computing.",
    ),
]
