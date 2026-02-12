# Modular Seed Data

Composable, object-based SQL modules for seeding the database. Each file contains all INSERTs for a single logical object (artifact + junctions + resource rows) with `ON CONFLICT DO NOTHING` for idempotency.

## Folder Structure

```
modules/
  00-base/          # System resource tables (always loaded)
  01-providers/     # One file per AI provider
  02-models/        # One file per model, grouped by provider
    openai/
    gemini/
  03-agents/        # One file per system agent
  04-tools/         # All MCP tool definitions
  05-auth/          # Generic auth providers (Google, Microsoft)
  10-setups/
    university/     # University-specific seed data
      00-auth/      # Institution auth (Purdue SAML, etc.)
      01-departments/
      02-personas/
      03-documents/
      04-fields/
      05-rubrics/
      06-simulations/  # Each simulation includes inline scenarios
      07-evals/
      08-cohorts/
      09-profiles/
      10-settings/
```

## Quick Start

```bash
# Export modules from live database
make export-modules                    # Export all
make export-modules ARGS=models        # Export only models
make export-modules ARGS=base          # Export only base

# Load seed data via YAML config
make seed-from-yaml                    # Load using default config
make seed-from-yaml CONFIG=my.yaml     # Load using custom config
make seed-file-from-yaml               # Generate SQL file without loading
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
  setup: university
  university:
    departments: all
    personas: all
    simulations:
      - foundation-level-new
      - happy-practice
    # ...
```

Use `all` to include everything in a category, or list specific module names.

## What's Included vs Excluded

**Included (structural data):**
- Artifact tables (`*_artifact`)
- Resource tables (`*_resource`) — names, descriptions, models, pricing, etc.
- Junction tables (`*_junction`) — artifact-to-resource linkages
- Relation tables (`*_relation`) — system flag/domain mappings

**Excluded (runtime/secrets):**
- Entry tables (`*_entry`) — runtime analytical data
- Connection tables (`*_connection`) — runtime config data
- `keys_resource`, `provider_keys_resource`, `auth_item_keys_resource` — encrypted secrets
- `runs_resource`, `groups_resource` — runtime session data
- Materialized views — rebuilt via `REFRESH MATERIALIZED VIEW`

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
INSERT INTO public.model_descriptions_junction (...) VALUES (...) ON CONFLICT (...) DO NOTHING;
```

## Dependencies

Load order is enforced by folder numbering:
- `00-base/` has no dependencies
- `01-providers/` depends on base flags
- `02-models/` depends on providers
- `03-agents/` depends on models (for model references)
- `06-simulations/` depends on personas, departments
- `07-evals/` depends on simulations
- `08-cohorts/` depends on simulations
- `09-profiles/` depends on departments, cohorts
- `10-settings/` depends on providers, auth, departments

Within the loader, `session_replication_role = replica` disables FK checks during seeding.

## Regenerating Modules

```bash
# From project root:
make export-modules
```

This queries the live database and regenerates all module files. The export script uses actual FK constraint metadata from `pg_catalog` for correctness.
