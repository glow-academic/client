"""Post-creation links that require both ends to exist.

These are update operations that wire up bidirectional references
which can't be set at create time due to dependency ordering.
"""

from uuid import UUID

from database.seeds.ids import sid
from database.seeds.setups.university.colors import ALL_COLOR_IDS
from database.seeds.setups.university.departments import UNIVERSITY_DEPT
from database.seeds.setups.university.settings import UNIVERSITY_SETTING

# ---------------------------------------------------------------------------
# Pre-existing profile IDs (from 09-profiles in modules 01-10)
# ---------------------------------------------------------------------------

DEFAULT_ADMIN = UUID("019b3be4-36ef-7a5f-98ab-ccb879770be0")
DEFAULT_GUEST = UUID("019b3be4-36f0-792c-82d6-126664ed18b6")
DEFAULT_INSTRUCTIONAL = UUID("019b3be4-36f0-785d-9d61-32eae65689ca")
DEFAULT_MEMBER = UUID("019b3be4-36f0-7eb3-bc4e-bcab772edd92")
DEFAULT_SUPERADMIN = UUID("019b3be4-36f0-788c-9df2-481eb5917940")

# ---------------------------------------------------------------------------
# Department → Setting link
# ---------------------------------------------------------------------------

department_updates = [
    dict(
        id=UNIVERSITY_DEPT,
        settings_ids=[UNIVERSITY_SETTING],
    ),
]

# ---------------------------------------------------------------------------
# Setting → Colors link
# ---------------------------------------------------------------------------

setting_updates = [
    dict(
        id=UNIVERSITY_SETTING,
        color_ids=ALL_COLOR_IDS,
    ),
]

# ---------------------------------------------------------------------------
# Pre-existing Profile → Department link + email creation
# ---------------------------------------------------------------------------

profile_department_links = [
    dict(
        profile_id=DEFAULT_ADMIN,
        department_ids=[UNIVERSITY_DEPT],
        email="default-admin@university.edu",
    ),
    dict(
        profile_id=DEFAULT_GUEST,
        department_ids=[UNIVERSITY_DEPT],
        email="default-guest@university.edu",
    ),
    dict(
        profile_id=DEFAULT_INSTRUCTIONAL,
        department_ids=[UNIVERSITY_DEPT],
        email="default-instructional@university.edu",
    ),
    dict(
        profile_id=DEFAULT_MEMBER,
        department_ids=[UNIVERSITY_DEPT],
        email="default-member@university.edu",
    ),
    dict(
        profile_id=DEFAULT_SUPERADMIN,
        department_ids=[UNIVERSITY_DEPT],
        email="default-superadmin@university.edu",
    ),
]
