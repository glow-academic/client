"""MCP server for artifacts, resources, and entries."""

import os

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .endpoints import register_endpoints

load_dotenv()

# Get origin and app prefix from environment
ORIGIN = os.getenv("ORIGIN", "http://localhost:3000")
APP_PREFIX = os.getenv("APP_PREFIX", "").strip("/")

# Extract hostname from ORIGIN (e.g., "https://company.ashoksaravanan.com" -> "company.ashoksaravanan.com")
from urllib.parse import urlparse

parsed_origin = urlparse(ORIGIN)
public_host = parsed_origin.hostname or "localhost"
public_port = parsed_origin.port or (443 if parsed_origin.scheme == "https" else 80)

# Configure FastMCP transport security to allow the public domain and internal hosts
# This fixes the 421 "Invalid Host header" error from FastMCP's DNS rebinding protection
# Note: Host header from nginx is "company.ashoksaravanan.com" (no port), so we need
# to allow both the hostname alone and with port patterns
transport_security = TransportSecuritySettings(
    enable_dns_rebinding_protection=True,
    allowed_hosts=[
        public_host,  # Exact hostname without port (what nginx sends)
        f"{public_host}:*",  # Public domain with any port (wildcard)
        f"{public_host}:{public_port}",  # Public domain with explicit port
        "localhost",
        "localhost:*",
        "127.0.0.1",
        "127.0.0.1:*",
        "server",  # Docker service name without port
        "server:*",  # Docker service name with any port
        "server:8000",  # Docker service name with explicit port
    ],
    allowed_origins=[
        "*",  # Allow all origins - OAuth tokens provide the real security
    ],
)

# Create MCP server instance with transport security configured
mcp_server = FastMCP(
    "GLOW",
    stateless_http=True,
    transport_security=transport_security,
    instructions=f"""\
GLOW exposes 3 tool classes: Artifacts, Resources, and Entries.

## Tool Classes

| Class | Purpose | Operations |
|-------|---------|------------|
| Artifacts (29) | Domain objects with full CRUD | get, list, save, delete, duplicate, draft, refresh |
| Resources (75) | Shared building-block data | get, search, create |
| Entries (101) | Transactional records and operational data | get, search, create |

## Workflow — Always follow this order:

1. **Discover** — call `artifacts()`, `resources()`, or `entries()` to find the right item name.
2. **Schema** — call `payload_artifact(name, op)`, `payload_resource(name, op)`, or `payload_entry(name, op)` to get the JSON schema for the request payload. Always do this before calling an operation.
3. **Operate** — call the operation tool with the name and payload.

## Choosing the right class

- **Artifact** = a configurable domain object (agent, scenario, cohort, document, etc.). Use when you need to read, create, edit, or manage these objects.
- **Resource** = a shared sub-component (names, descriptions, flags, prompts, etc.). Use when you need to read or create individual resource records that artifacts reference.
- **Entry** = operational/transactional data (attempts, sessions, metrics, drafts, insights, etc.). Use when you need to read operational state, search records, or create transactional entries.

## Creating an Artifact — Standard Workflow

Artifacts are saved with resource IDs, not raw text. To create one:

### Step 1: Load available resources
Call `get_artifact(name, {{}})` with an empty payload (no ID). This returns ALL available resources as suggestions — names, descriptions, departments, personas, etc. Each resource has an `id` you can reuse directly. **Reuse existing resources whenever possible** — this is the fastest path.

### Step 2: Create only what's new
If you need a new name or description that doesn't exist yet, create just those resources:
- `create_resource("names", {{"name": "My New Scenario"}})`  → returns `name_id`
- `create_resource("descriptions", {{"description": "..."}})`  → returns `description_id`

### Step 3: Save the artifact
Call `save_artifact(name, payload)` with the resource IDs — a mix of reused IDs from Step 1 and newly created IDs from Step 2.

### Example: Creating a scenario

Scenario save accepts these fields:

| Field | Type | Required | Source |
|-------|------|----------|--------|
| `input_scenario_id` | UUID | No (omit to create new) | Existing scenario ID for edits |
| `name_id` | UUID | **Yes** | `names.resources[]` or `create_resource("names", ...)` |
| `description_id` | UUID | No | `descriptions.resources[]` or `create_resource("descriptions", ...)` |
| `problem_statement_id` | UUID | No | `problem_statements.resources[]` or `create_resource("problem_statements", ...)` |
| `active_flag_id` | UUID | No | `flags.resources[]` (key: "active") |
| `objectives_enabled_flag_id` | UUID | No | `flags.resources[]` (key: "objectives_enabled") |
| `images_enabled_flag_id` | UUID | No | `flags.resources[]` (key: "images_enabled") |
| `video_enabled_flag_id` | UUID | No | `flags.resources[]` (key: "video_enabled") |
| `questions_enabled_flag_id` | UUID | No | `flags.resources[]` (key: "questions_enabled") |
| `problem_statement_enabled_flag_id` | UUID | No | `flags.resources[]` (key: "problem_statement_enabled") |
| `department_ids` | list[UUID] | No | `departments.resources[]` |
| `persona_ids` | list[UUID] | **Yes** (≥1) | `personas.resources[]` |
| `document_ids` | list[UUID] | No | `documents.resources[]` |
| `parameter_ids` | list[UUID] | No | `parameters.resources[]` |
| `parameter_field_ids` | list[UUID] | No | `parameter_fields.resources[]` |
| `image_ids` | list[UUID] | No | `images.resources[]` |
| `objective_ids` | list[UUID] | No | `objectives.resources[]` |
| `video_ids` | list[UUID] | No | `videos.resources[]` |
| `question_ids` | list[UUID] | No | `questions.resources[]` |
| `option_ids` | list[UUID] | No | `options.resources[]` |

**Minimum required fields: `name_id` + `persona_ids` (at least one persona).**

Workflow:
```
1. get_artifact("scenario", {{}})
   → Response includes: names.resources[], descriptions.resources[],
     departments.resources[], personas.resources[], flags.resources[], etc.
   → Pick existing IDs to reuse (e.g., department_ids, persona_ids)

2. create_resource("names", {{"name": "Interview Practice: Sales Role"}})
   → Returns: {{"id": "<new-name-id>", ...}}
   create_resource("descriptions", {{"description": "Practice a sales interview..."}})
   → Returns: {{"id": "<new-desc-id>", ...}}

3. save_artifact("scenario", {{
     "name_id": "<new-name-id>",
     "description_id": "<new-desc-id>",
     "department_ids": ["<existing-dept-id>"],
     "persona_ids": ["<existing-persona-id>"],
     "active_flag_id": "<flag-id-from-step-1>"
   }})
   → Returns: {{"success": true, "scenario_id": "<new-id>"}}
```

After saving, the user can view their scenario at:
**{ORIGIN}/training/scenarios/<scenario_id>**

Always share this link with the user after a successful create or save.

This pattern (get → create resources → save) works for ALL artifacts: agent, cohort, document, persona, simulation, eval, rubric, etc. The `get` response always tells you what resources are available and what's required.

### Editing an existing artifact
Same pattern, but pass the artifact ID:
1. `get_artifact("scenario", {{"scenario_id": "<id>"}})` — returns current state + all available resources
2. Create any new resources needed
3. `save_artifact("scenario", {{"input_scenario_id": "<id>", ...all resource IDs}})` — include ALL resource IDs, not just changed ones

## URLs for artifacts

After creating or saving an artifact, share the URL with the user so they can view it:

| Artifact | URL |
|----------|-----|
| scenario | `{ORIGIN}/training/scenarios/<id>` |
| agent | `{ORIGIN}/training/agents/<id>` |
| persona | `{ORIGIN}/training/personas/<id>` |
| simulation | `{ORIGIN}/training/simulations/<id>` |
| cohort | `{ORIGIN}/training/cohorts/<id>` |
| document | `{ORIGIN}/training/documents/<id>` |
| eval | `{ORIGIN}/training/evals/<id>` |
| rubric | `{ORIGIN}/training/rubrics/<id>` |
| parameter | `{ORIGIN}/training/parameters/<id>` |
| field | `{ORIGIN}/training/fields/<id>` |

## Documentation

Call `docs()` for general architecture. Call `docs_artifact(name)`, `docs_resource(name)`, or `docs_entry(name)` for detailed documentation on a specific item including schema, relationships, and usage patterns.

## Key rules

- Item names are **singular** for artifacts (e.g., "agent", not "agents") and **plural** for resources (e.g., "names", not "name"). Entry names vary — use the discovery tool to confirm.
- The `mcp` field in payloads is auto-injected — never include it.
- All operations require authentication via OAuth token in the Authorization header.
""",
)

# Register all endpoints
register_endpoints(mcp_server)

__all__ = ["mcp_server"]
