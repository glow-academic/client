# Tables with generated and mcp booleans
_Exported on 1/10/2026 at 14:22:32 CST from Cursor (2.3.29)_

---

**User**

Can you use /creds to see what tables have the generated boolean, and the mcp boolean?

--- Cursor Command: creds.md ---
# Database Credentials

Use these credentials to connect to the local PostgreSQL database via `psql`:

```bash
DB_USER="myuser"
DB_PASSWORD="mypassword"
DB_NAME="mydb"
DB_PORT="5432"
DB_HOST="localhost"
```

**Connection string:**
```bash
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

**Note:** These are the default credentials used by the Makefile and docker-compose setup.
--- End Command ---

---

**Cursor**


Checking which tables have `generated` and `mcp` boolean columns.



Found tables with `generated` and/or `mcp` boolean columns:

**Tables with both `generated` and `mcp` columns:**
- agents, analyses, audios, auth, cohorts, colors, conversations, debug_info, departments, descriptions, documents, endpoints, evals, examples, feedbacks, fields, flags, hints, html, icons, images, improvements, instructions, items, keys, models, names, objectives, options, parameters, personas, points, problem_statements, profiles, prompts, protocols, questions, responses, rubrics, scenarios, schema_field_items, schema_fields, schemas, settings, simulations, slugs, standard_groups, strengths, template_array_items, template_values, templates, texts, thresholds, times, videos

**Tables with only `generated` (no `mcp`):**
- contents

**Summary:**
- 55 tables have both `generated` and `mcp`
- 1 table (`contents`) has only `generated`

All columns are boolean. Should I check specific tables or help with a migration?

---

**User**

How many of these tables have a resource (you can check resources enum), that only requires id, essentially meaning it is just a junction table, since it connects an artifact and resource?

---

**Cursor**


Checking the resources enum, then identifying tables with a `resource` column that are junction tables (only `id` plus artifact/resource references).



Checking the structure of these tables to identify junction tables:



Checking which of the original tables (with `generated`/`mcp`) also have a `resource` column, and which are junction tables:



Checking which tables with `generated`/`mcp` have an `artifact` column (indicating a junction table):



Checking `artifact_resources` structure and whether it has `generated`/`mcp` columns:



Checking which tables with a `resource` column are junction tables (minimal structure, primarily foreign keys):



Checking which tables with `generated`/`mcp` are junction tables (minimal structure, primarily foreign keys):



Checking if `artifact_resources` or other junction tables have `generated`/`mcp` columns, and verifying which tables with `resource` columns are junction tables:



Checking if any tables with `generated`/`mcp` have an `artifact` column (indicating a junction table):



**Answer: 0 tables**

None of the tables with `generated`/`mcp` columns have a `resource` column (from the resources enum) and are junction tables.

**Findings:**
- 56 tables have `generated` and/or `mcp` columns
- None of these tables have a `resource` column
- None of these tables have an `artifact` column

**Junction tables with `resource` columns:**
- `artifact_resources` — connects artifacts to resources (no `id`, composite PK)
- `resource_modalities` — connects resources to modalities
- `resource_schemas` — connects schemas to resources
- `resource_tools` — connects tools to resources

These junction tables don't have `generated`/`mcp` columns.

The tables with `generated`/`mcp` (like `agents`, `analyses`, `personas`, etc.) are the resource tables themselves, not junction tables. They represent the resources directly, not relationships between artifacts and resources.

