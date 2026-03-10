"""Organization setup — seed definitions.

Dependency order (each module may reference IDs from earlier modules):
  1. departments
  2. personas       (refs: departments)
  3. fields         (refs: departments)
  4. parameters     (refs: fields, departments)
  5. settings       (refs: departments, auth, systems, thresholds)
  6. post_links     (refs: departments, settings, pre-existing profiles)
"""

SETUP_NAME = "organization"

# Dependency-ordered list of module names to seed.
# Each corresponds to a .py file in this package.
MODULES = [
    "departments",
    "personas",
    "fields",
    "parameters",
    "settings",
    "post_links",
]
