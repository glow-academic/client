"""University setup — seed definitions.

Dependency order (each module may reference IDs from earlier modules):
  1. departments
  2. documents
  3. personas
  4. rubrics
  5. fields         (standalone field values)
  6. parameters     (refs: fields)
  7. content        (objectives, questions, options — standalone resources)
  8. scenarios      (refs: personas, documents, content)
  9. scenario_rubrics (refs: scenarios, rubrics)
  10. simulations   (refs: scenarios, scenario_rubrics)
  11. profiles      (refs: departments)
  12. cohorts       (refs: simulations, profiles)
  13. settings      (refs: departments, auth, providers, systems)
  14. colors        (standalone color resources)
  15. texts         (refs: documents — text upload chain + document link)
  16. files         (refs: documents — file upload chain + document link)
  17. post_links    (refs: departments, settings, colors, pre-existing profiles)
"""

SETUP_NAME = "university"

# Dependency-ordered list of module names to seed.
# Each corresponds to a .py file in this package.
MODULES = [
    "departments",
    "documents",
    "personas",
    "rubrics",
    "fields",
    "parameters",
    "content",
    "scenarios",
    "scenario_rubrics",
    "simulations",
    "profiles",
    "cohorts",
    "settings",
    "colors",
    "texts",
    "files",
    "post_links",
]
