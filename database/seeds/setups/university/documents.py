"""University document seed definitions.

Each document is a dict mapping directly to CreateDocumentItem.
Names and descriptions are CREATED as new resources.

These documents can be linked to scenarios via document_ids.
"""

from database.seeds.ids import sid
from database.seeds.setups.university.departments import UNIVERSITY_DEPT

# ---------------------------------------------------------------------------
# Deterministic IDs — importable by scenarios, etc.
# ---------------------------------------------------------------------------

ACADEMIC_INTEGRITY_POLICY = sid("uni/document/academic-integrity-policy")
FERPA_POLICY = sid("uni/document/ferpa-policy")
SYLLABUS_TEMPLATE = sid("uni/document/syllabus-template")

# ---------------------------------------------------------------------------
# Document definitions
# ---------------------------------------------------------------------------

documents = [
    dict(
        id=ACADEMIC_INTEGRITY_POLICY,
        name="Academic Integrity Policy",
        description="University policy document covering academic honesty, plagiarism, and integrity violations.",
        department_ids=[UNIVERSITY_DEPT],
    ),
    dict(
        id=FERPA_POLICY,
        name="FERPA Policy",
        description="Family Educational Rights and Privacy Act policy covering student record privacy and data protection.",
        department_ids=[UNIVERSITY_DEPT],
    ),
    dict(
        id=SYLLABUS_TEMPLATE,
        name="Syllabus Template",
        description="Standard university syllabus template for course planning and student reference.",
        department_ids=[UNIVERSITY_DEPT],
    ),
]
