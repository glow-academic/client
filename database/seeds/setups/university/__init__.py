"""University setup — seed definitions.

Dependency order (each module may reference IDs from earlier modules):
  1. departments
  2. documents
  3. personas
  4. rubrics
  5. content        (objectives, questions, options — standalone resources)
  6. scenarios      (refs: personas, documents, content)
  7. scenario_rubrics (refs: scenarios, rubrics)
  8. simulations    (refs: scenarios, scenario_rubrics)
  9. profiles       (refs: departments)
  10. cohorts       (refs: simulations, profiles)
  11. settings      (refs: departments, auth, providers, systems)
  12. post_links    (refs: departments, settings)
"""

SETUP_NAME = "university"

# Dependency-ordered list of module names to seed.
# Each corresponds to a .py file in this package.
MODULES = [
    "departments",
    "documents",
    "personas",
    "rubrics",
    "content",
    "scenarios",
    "scenario_rubrics",
    "simulations",
    "profiles",
    "cohorts",
    "settings",
    "post_links",
]
