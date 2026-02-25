# Modular Seed Data

Static, composable SQL modules for seeding the database. Each file contains all INSERTs for a single logical object (artifact + junctions + resource rows) with `ON CONFLICT DO NOTHING` for idempotency.

These files are the **source of truth** for seed data — edit them directly when adding or modifying seed data.

## Folder Structure

```
modules/
  01-resources/     # Shared resource tables (colors, icons, flags, voices, etc.)
  02-providers/     # One file per AI provider
  03-models/        # One file per model, grouped by provider
    openai/
    gemini/
  04-agents/        # One file per system agent
  05-tools/         # All MCP tool definitions
  06-auth/          # Generic auth providers (Google, Microsoft)
  07-rubrics/       # Rubric definitions
  08-evals/         # Evaluation definitions
  09-profiles/      # Base profile definitions
  11-setups/
    organization/   # Organization-specific seed data
      01-departments/
      09-profiles/
      10-settings/
    university/     # University-specific seed data
      00-auth/      # Institution auth (Purdue SAML, etc.)
      01-departments/
      02-personas/
      03-documents/
      04-fields/
      05-parameters/
      05-rubrics/
      06-simulations/
      07-scenarios/
      08-cohorts/
      09-profiles/
      10-settings/
      uploads/
      texts/
      themes/
```

## Quick Start

```bash
# Build test seed SQL from modules (uses YAML config to select modules)
make build-test-seed

# Load seed data via YAML config directly into database
make seed-from-yaml                    # Load using default config
make seed-from-yaml CONFIG=my.yaml     # Load using custom config
```

## YAML Config

Add a `modules` section to `config.yaml` (see `config.example.yaml`):

```yaml
modules:
  providers:
    - openai
    - gemini
  models:
    openai:
      - gpt-5.1
      - gpt-5
    gemini:
      - gemini-2.5-pro
  agents: all
  tools: all
  auth:
    - google
    - microsoft
  university:
    departments: all
    personas: all
    simulations:
      - foundation-level-new
      - happy-practice
    # ...
```

Use `all` to include everything in a category, or list specific module names.

## Load Order

The loader (`load-modules.sh`) enforces this order:

1. `01-resources/` — all shared resources
2. `02-providers/` — AI providers
3. `03-models/` — models (references resources + providers)
4. `05-tools/` — MCP tools (before agents)
5. `04-agents/` — agents (references tools via junction)
6. `06-auth/` — auth providers
7. `07-rubrics/` — rubrics
8. `08-evals/` — evaluations
9. `09-profiles/` — base profiles
10. `11-setups/` — per-setup categories in this order:
    - settings, departments, parameters, fields, personas, documents,
      uploads, texts, rubrics, simulations, scenarios, cohorts, profiles, themes

The `reasoning_levels_resource` FK to `model_artifact` creates a circular dependency — the loader temporarily drops and re-adds this constraint during seeding.

## Module File Format

Each file follows this structure:

```sql
-- Module: gpt-5.1
-- Provider: openai
-- Description: openai gpt-5.1 model
-- ============================================================

-- Resource rows
INSERT INTO public.names_resource (...) VALUES (...) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (...) VALUES (...) ON CONFLICT (id) DO NOTHING;

-- Artifact
INSERT INTO public.model_artifact (...) VALUES (...) ON CONFLICT (id) DO NOTHING;

-- Junctions
INSERT INTO public.model_names_junction (...) VALUES (...) ON CONFLICT (...) DO NOTHING;
```

## Adding New Seed Data

1. Create a new `.sql` file in the appropriate module directory
2. Follow the existing file format (header comment, resource rows, artifact, junctions)
3. Use `ON CONFLICT (id) DO NOTHING` or `ON CONFLICT (pk1, pk2) DO NOTHING` for idempotency
4. Add the module name to the relevant YAML config if not using `all`
5. Run `make build-test-seed` to rebuild the test seed
