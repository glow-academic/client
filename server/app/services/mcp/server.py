# generic_server.py  — “Domain-API” MCP server
from typing import Any, Dict, List

from app.db import get_session
from mcp.server.fastmcp import FastMCP
from sqlmodel import select

# ─────────────────────────────────────────────────────────────────────────────
generic = FastMCP("Domain-API")

# ─────────────────────────────────────────────────────────────────────────────
# NEW ✱ Dashboard-editing helpers
# ─────────────────────────────────────────────────────────────────────────────

@generic.tool()
def update_component_layout(component_id: str, layout: Dict[str, Any]) -> str:
    """
    Overwrite the JSONB `layout` of a single `Components` row.

    Expected workflow
    -----------------
    1. `SELECT * FROM components WHERE id = :component_id FOR UPDATE`.
    2. Merge/replace the layout field with the supplied `layout`.
    3. `UPDATE components SET layout = :layout, updated_at = now()` …
    4. Return the component UUID (or 'OK').

    Security / validation
    ---------------------
    • Ensure caller is authorised to edit this component (join through `Dashboards` ➜ `Profiles`).  
    • Validate the JSON shape (e.g. contains `x, y, w, h`).

    Returns
    -------
    "OK" on success *or* the updated component UUID.
    """
    raise NotImplementedError  # ← implement here


@generic.tool()
def patch_dashboard_settings(
    profile_id: str,
    settings: Dict[str, Any]
) -> str:
    """
    Partially update a `Dashboards` row (e.g. auto_scroll, main_split).

    Steps
    -----
    1. Fetch dashboard for `profile_id`; create if missing.
    2. Apply diff only to recognised columns.
    3. Commit & return the dashboard UUID.

    *Write-side changes live in generic_server, never in db_server.*
    """
    raise NotImplementedError


# ─────────────────────────────────────────────────────────────────────────────
# NEW ✱ Student / chat analytics helpers
# ─────────────────────────────────────────────────────────────────────────────

@generic.tool()
def get_student_simulation_report(profile_id: str) -> Dict[str, Any]:
    """
    Aggregate everything about one student across simulations.

    Output schema (example)
    -----------------------
    {
      "profile": { "id": "...", "name": "...", … },
      "attempts": [
        {
          "simulation_id": "...",
          "title": "Cardiac Arrest",
          "scenario": { "id": "...", "name": "…" },
          "chat": {
            "messages": [ {"t": "...", "role": "user", "content": "..."}, … ],
            "grade":    { "score": 87, "passed": true, … },
            "feedback": [ {"standard": "Clarity", "pts": 2, "comment": "…"}, … ]
          }
        },
        …
      ]
    }

    Implementation notes
    --------------------
    • Join chain: `Profiles ➜ SimulationAttempts ➜ SimulationChats`  
      → then LEFT JOIN grades & feedback tables.  
    • Cap messages to latest *N* or summarise to avoid huge payloads.  
    • Return JSON-serialisable primitives only.
    """
    raise NotImplementedError


# ─────────────────────────────────────────────────────────────────────────────
# NEW ✱ Search helpers (read-only; heavy joins live here, ad-hoc SQL stays in db_server)
# ─────────────────────────────────────────────────────────────────────────────

@generic.tool()
def search_by_cohort(cohort_id: str) -> Dict[str, Any]:
    """
    Return high-level info scoped to one cohort:

    • Cohort metadata + roster  
    • Classes tied to those profiles (`class_ids`)  
    • Active simulations / scenarios linked via the cohort → simulations.cohort_ids
    """
    raise NotImplementedError


@generic.tool()
def search_by_profile(profile_id: str) -> Dict[str, Any]:
    """
    Return a student-centric view:

    • Profile & user info  
    • Classes enrolled, dashboard settings  
    • SimulationAttempts (+ latest grades)  
    • AssistantChats history metadata (no full messages)
    """
    raise NotImplementedError


@generic.tool()
def search_by_class(class_id: str) -> Dict[str, Any]:
    """
    Summarise a class:

    • Class record + schedules/events/topics  
    • Roster (Profiles) ➜ include alias + role  
    • Scenarios & simulations where class_id matches
    """
    raise NotImplementedError


@generic.tool()
def search_by_simulation(simulation_id: str) -> Dict[str, Any]:
    """
    Drill into one simulation:

    • Simulation metadata, rubric summary  
    • Cohorts / scenarios involved  
    • Attempt counts, pass-rate, latest grades per profile (aggregate)
    """
    raise NotImplementedError


@generic.tool()
def search_by_scenario(scenario_id: str) -> Dict[str, Any]:
    """
    Detail a scenario:

    • Scenario record + linked class & agent  
    • SimulationChats + EvalChats counts  
    • Recent feedback themes (group by Standard)
    """
    raise NotImplementedError


@generic.tool()
def search_by_agent(agent_id: str) -> Dict[str, Any]:
    """
    Agent dashboard:

    • Agent config (system_prompt, temperature)  
    • Scenarios powered by this agent  
    • EvalRuns history & pass-rate statistics
    """
    raise NotImplementedError


# ─────────────────────────────────────────────────────────────────────────────
# Utilities (optional): row-limit decorator, JSON serialiser helpers, etc.
# ─────────────────────────────────────────────────────────────────────────────
