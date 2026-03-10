"""Post-creation links that require both ends to exist.

These are update operations that wire up bidirectional references
which can't be set at create time due to dependency ordering.
"""

from database.seeds.setups.university.departments import UNIVERSITY_DEPT
from database.seeds.setups.university.settings import UNIVERSITY_SETTING

# ---------------------------------------------------------------------------
# Department → Setting link
# ---------------------------------------------------------------------------

department_updates = [
    dict(
        id=UNIVERSITY_DEPT,
        settings_ids=[UNIVERSITY_SETTING],
    ),
]
