"""University setup — seed definitions.

Dependency order (each module may reference IDs from earlier modules):
  1. departments
  2. personas
  3. documents
  4. fields
  5. parameters
  6. rubrics
  7. scenarios      (refs: personas, documents, fields)
  8. simulations    (refs: scenarios)
  9. cohorts        (refs: simulations)
  10. profiles      (refs: departments)
  11. settings      (refs: departments, auth, providers, systems)
"""

SETUP_NAME = "university"

# Dependency-ordered list of module names to seed.
# Each corresponds to a .py file in this package.
MODULES = [
    "departments",
    "documents",
    "personas",
    "scenarios",
    "simulations",
    "cohorts",
    # TODO: profiles, settings
]
