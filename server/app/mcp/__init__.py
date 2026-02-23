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
GLOW is an educational platform for scenario-based learning and AI-powered practice simulations.

## Tool Classes

| Class | Purpose | Operations |
|-------|---------|------------|
| Artifacts | Domain objects (scenario, persona, cohort, simulation, etc.) | get, list, save, delete, duplicate, draft, refresh |
| Resources | Shared building blocks (names, descriptions, flags, etc.) | get, search, create |
| Entries | Transactional/operational data (attempts, sessions, metrics, etc.) | get, search, create |

## Creating or Editing an Artifact

Artifacts reference resources by ID. Follow these steps:

### Step 1: Call `get_artifact` first — always

```
get_artifact("scenario", {{}})              # new artifact (no ID)
get_artifact("scenario", artifact_id="<id>")  # edit existing
```

The response contains everything you need:
- **`group_id`** — pass this to `create_resource` calls so new resources are grouped together
- **`resources`** — available resources to reuse (names, descriptions, personas, departments, flags, etc.). Each has an `id`.
- **`current`** — currently selected resources (when editing an existing artifact)
- **Per-resource `tool_id`** — pass to `create_resource` for AI generation tracking

**Reuse existing resources whenever possible** — only create new ones when needed.

### Step 2: Create only what's new

Use `create_resource` for resources that don't exist yet. Always pass `group_id` from Step 1. If the get response included a `tool_id` for that resource type, pass it too (optional — not all resources have tools):

```
create_resource("names", {{"name": "Interview Practice"}}, group_id="<from step 1>", tool_id="<if available>")
→ returns id

create_resource("descriptions", {{"description": "Practice a sales interview..."}}, group_id="<from step 1>")
→ returns id (no tool_id needed if none was returned for descriptions)
```

### Step 3: Draft (recommended) or Save

**Recommended: use `draft_artifact`** — this creates a draft the user can review and edit in the UI before committing:

```
draft_artifact("scenario", {{
  "name_id": "<new-or-reused-id>",
  "description_id": "<new-or-reused-id>",
  "department_ids": ["<existing-dept-id>"],
  "persona_ids": ["<existing-persona-id>"]
}})
→ returns draft_id
```

Share the draft link so the user can review:
**{ORIGIN}/training/scenarios/new?draftId=<draft_id>**

**Alternative: use `save_artifact`** for a direct save when the user wants to skip the review step:

```
save_artifact("scenario", {{
  "name_id": "<id>",
  "persona_ids": ["<id>"],
  ...
}})
→ returns scenario_id
```

Share the artifact link: **{ORIGIN}/training/scenarios/<scenario_id>**

### Editing an existing artifact

Same 3-step pattern, but pass the artifact ID:
1. `get_artifact("scenario", artifact_id="<id>")` — returns current state + all available resources
2. Create any new resources needed (with `group_id` from step 1)
3. `draft_artifact` or `save_artifact` with ALL resource IDs (not just changed ones). For save, include `input_scenario_id`.

## Artifact URLs

Always share a link with the user after drafting or saving:

| Artifact | Saved | Draft |
|----------|-------|-------|
| scenario | `{ORIGIN}/training/scenarios/<id>` | `{ORIGIN}/training/scenarios/new?draftId=<draft_id>` |
| persona | `{ORIGIN}/training/personas/<id>` | `{ORIGIN}/training/personas/new?draftId=<draft_id>` |
| simulation | `{ORIGIN}/training/simulations/<id>` | `{ORIGIN}/training/simulations/new?draftId=<draft_id>` |
| cohort | `{ORIGIN}/training/cohorts/<id>` | `{ORIGIN}/training/cohorts/new?draftId=<draft_id>` |

## Discovery & Documentation

- `discover_artifacts()`, `discover_resources()`, `discover_entries()` — find available items
- `docs("scenario")`, `docs("names")`, `docs("glow")` — get schema and documentation

## Key Rules

- Artifact names are **singular** ("scenario"), resource names are **plural** ("names"). Use discovery tools to confirm entry names.
- The `mcp` field is auto-injected — never include it in payloads.
- `group_id` and `tool_id` on `create_resource` are explicit parameters, not part of the payload dict.
""",
)

# Register all endpoints
register_endpoints(mcp_server)

__all__ = ["mcp_server"]
