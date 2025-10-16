# server.py — Clean MCP server wrapper that imports all individual tools
# Import analytics tools
from typing import Any, Dict, List

from app.db import get_pool
from app.services.mcp.tools.analytics.cohort_pass_matrix import \
    cohort_pass_matrix
from app.services.mcp.tools.analytics.persona_response_times import \
    persona_response_times
from app.services.mcp.tools.analytics.simulation_attempts import \
    simulation_attempts
from app.services.mcp.tools.analytics.student_sim_report import \
    student_sim_report
# Import log tools
from app.services.mcp.tools.log.assistant_usage import assistant_usage
from app.services.mcp.tools.log.export_csv import export_csv
from app.services.mcp.tools.log.recent_app_logs import recent_app_logs
from app.services.mcp.tools.lookup.cohort_overview import cohort_overview
# Import lookup tools
from app.services.mcp.tools.lookup.persona_overview import persona_overview
from app.services.mcp.tools.lookup.profile_overview import profile_overview
from app.services.mcp.tools.lookup.scenario_overview import scenario_overview
from app.services.mcp.tools.lookup.simulation_overview import \
    simulation_overview
# Import schema tools
from app.services.mcp.tools.schema.list_schema import list_schema
from app.services.mcp.tools.schema.query_data import query_data
# Import search tools
from app.services.mcp.tools.search.find_cohorts import find_cohorts
from app.services.mcp.tools.search.find_personas import find_personas
from app.services.mcp.tools.search.find_profiles import find_profiles
from app.services.mcp.tools.search.find_scenarios import find_scenarios
from app.services.mcp.tools.search.find_simulations import find_simulations
from mcp.server.fastmcp import FastMCP

# ─────────────────────────────────────────────────────────────────────────────
# Configure MCP server for stateless HTTP transport
server = FastMCP("Domain-API", stateless_http=True)

# ─────────────────────────────────────────────────────────────────────────────
# ✱ Schema / Meta Tools (2 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
async def _list_schema() -> str:
    """
    Database schema overview
    Lists all tables and columns in the public schema.

    Quick-start
      ask:  "What tables are in the DB?"
      call: list_schema()
    """
    pool = get_pool()
    if not pool:
        return "Error: Database pool not initialized"
    
    async with pool.acquire() as conn:
        return await list_schema(conn)


@server.tool()
async def _query_data(sql: str) -> str:
    """
    Custom SQL queries (read-only)
    Run SELECT or EXPLAIN queries with a 200-row limit.
    All standard SELECT clauses like WHERE, LIKE, JOIN, GROUP BY, ORDER BY are supported.

    Input
      • sql - A standard SQL SELECT or EXPLAIN statement.

    Returns
      Raw query results as text, or an error message.

    Quick-start
      ask:  "Run this SQL: SELECT * FROM profiles LIMIT 5"
      call: query_data("SELECT first_name, last_name FROM profiles LIMIT 5")

    Troubleshooting
      • If you get a "no such column" or "no such table" error, your query is likely using an incorrect name.
      • **Fallback:** Call the `list_schema()` tool first to see the available tables and exact column names before trying your query again.

    Security
      • Only SELECT and EXPLAIN statements are allowed.
      • UPDATE, INSERT, DELETE, and other write operations are blocked.
    """
    pool = get_pool()
    if not pool:
        return "Error: Database pool not initialized"
    
    async with pool.acquire() as conn:
        return await query_data(conn, sql)


# ─────────────────────────────────────────────────────────────────────────────
# ✱ Quick Look-ups (5 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
async def _profile_overview(profile_id: str) -> Dict[str, Any]:
    """
    Profile overview
    ----------------
    Profile + last login, classes, dashboard flags, latest grades.
    Accepts UUID or name.

    Input
      • profile_id - UUID or name/alias to search for

    Returns
      { "profile": { … }, "latest_grades": [ … ] }

    Quick-start
      ask:  "Show me Nina Park's profile"
      call: profile_overview("Nina Park")

    See also 👉 student_sim_report() for per-chat detail.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await profile_overview(conn, profile_id)


@server.tool()
async def _cohort_overview(cohort_id: str) -> Dict[str, Any]:
    """
    🔎 Cohort overview
    ------------------
    Cohort meta, roster, active sims, pass-rate.

    Input
      • cohort_id – UUID of the cohort

    Returns
      { "cohort": { … }, "roster": [ … ], "simulations": [ … ], "stats": { … } }

    Quick-start
      ask:  "How's Fall 2025 Cohort A doing?"
      call: cohort_overview("uuid-here")

    See also 👉 cohort_pass_matrix() for detailed pass/fail data.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await cohort_overview(conn, cohort_id)


@server.tool()
async def _simulation_overview(sim_id: str) -> Dict[str, Any]:
    """
    🔎 Simulation overview
    ----------------------
    Sim meta, rubric, cohorts, scenarios, pass stats.

    Input
      • sim_id – UUID of the simulation

    Returns
      { "simulation": { … }, "rubric": { … }, "cohorts": [ … ], "stats": { … } }

    Quick-start
      ask:  "Give me the Induction Homework sim stats"
      call: simulation_overview("uuid-here")

    See also 👉 simulation_attempts() for detailed attempt list.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await simulation_overview(conn, sim_id)


@server.tool()
async def _scenario_overview(scenario_id: str) -> Dict[str, Any]:
    """
    🎭 Scenario overview with metadata & usage
    -----------------------------------------
    Show scenario details and associated simulations.

    Input
      • scenario_id – UUID of the scenario

    Returns
      { "id": "…", "title": "…", "simulations": […], … }

    Quick-start
      ask:  "Show me details for scenario X"
      call: scenario_overview("uuid-here")

    See also 👉 simulation_overview() for sim details.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await scenario_overview(conn, scenario_id)


@server.tool()
async def _persona_overview(persona_id: str) -> Dict[str, Any]:
    """
    Persona overview
    --------------
    Show persona details and associated simulations.

    Input
      • persona_id - UUID of the persona

    Returns
      { "id": "…", "name": "…", "scenarios": […], … }

    Quick-start
      ask:  "Show me details for persona X"
      call: persona_overview("uuid-here")

    See also 👉 simulation_overview() for sim details.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await persona_overview(conn, persona_id)


# ─────────────────────────────────────────────────────────────────────────────
# ✱ Search / Helper Tools (5 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
async def _find_profiles(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find profiles by name
    ------------------------
    Fuzzy first/last/alias search.

    Input
      • query - Name or alias to search for
      • limit - Max results (default: 10)

    Returns
      [
        {
          "id": str,           # Profile UUID
          "first_name": str | None,
          "last_name": str | None,
          "alias": str | None,
          "role": str | None,
          "full_name": str,    # "First Last" or alias or "Unknown"
          "score": int         # Heuristic match score
        },
        ...
      ]

    Quick-start
      ask:  "Find everyone named Jordan"
      call: await find_profiles("Jordan")

    See also 👉 profile_overview() for detailed profile data.
    """
    pool = get_pool()
    if not pool:
        return [{"error": "Database pool not initialized"}]
    
    async with pool.acquire() as conn:
        return await find_profiles(conn, query, limit)


@server.tool()
async def _find_simulations(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find simulations by title
    ----------------------------
    Fuzzy sim title search.

    Input
      • query - Simulation title to search for
      • limit - Max results (default: 10)

    Returns
      [
        {
          "id": str,                # Simulation UUID
          "title": str | None,      # Simulation title
          "active": bool,           # Is the simulation active?
          "time_limit": int | None, # Time limit in minutes (if any)
          "created_at": str | None, # ISO8601 creation timestamp
          "score": int              # Heuristic match score
        },
        ...
      ]

    Quick-start
      ask:  "Which sims mention 'cardiac'?"
      call: await find_simulations("cardiac")

    See also 👉 simulation_overview() for detailed sim data.
    """
    pool = get_pool()
    if not pool:
        return [{"error": "Database pool not initialized"}]
    
    async with pool.acquire() as conn:
        return await find_simulations(conn, query, limit)


@server.tool()
async def _find_personas(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find personas by name
    ------------------------
    Performs a case-insensitive, fuzzy search on persona names.

    Input
        • query - Name of the persona to search for
        • limit - Max results (default: 10)

    Returns
        [ { "id": "...", "name": "...", "description": "...", "score": ... }, ... ]
        or [ { "error": "Database error: ..." } ] on failure

    Quick-start
        ask:  "Find the aggressive persona"
        call: await find_personas("Aggressive")

    See also 👉 persona_overview() for detailed persona data.
    """
    pool = get_pool()
    if not pool:
        return [{"error": "Database pool not initialized"}]
    
    async with pool.acquire() as conn:
        return await find_personas(conn, query, limit)


@server.tool()
async def _find_cohorts(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find cohorts by title/description
    ------------------------------------
    Fuzzy, case-insensitive search on cohort title and description.

    Input
        • query - Cohort title or description to search for
        • limit - Max results (default: 10)

    Returns
        [
            {
                "id": "...",
                "title": "...",
                "active": <bool>,
                "description": "...",
                "profile_count": <int>,
                "score": <int>
            },
            ...
        ]

    Quick-start
        ask:  "Find all Fall 2025 cohorts"
        call: await find_cohorts("Fall 2025")

    See also 👉 cohort_overview() for detailed cohort data.
    """
    pool = get_pool()
    if not pool:
        return [{"error": "Database pool not initialized"}]
    
    async with pool.acquire() as conn:
        return await find_cohorts(conn, query, limit)


@server.tool()
async def _find_scenarios(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find scenarios by name/problem_statement
    --------------------------------------------
    Fuzzy, case-insensitive search on scenario name and problem statement.

    Input
        • query - Scenario name or problem statement to search for
        • limit - Max results (default: 10)

    Returns
        [
            {
                "id": str,                       # Scenario UUID
                "name": str | None,              # Scenario name/title
                "problem_statement": str | None, # Scenario problem statement
                "persona_id": str | None,        # Linked persona UUID (if any)
                "default_scenario": bool,        # Is this the default scenario?
                "score": int                     # Heuristic match score
            },
            ...
        ]

    Quick-start
        ask:  "Find scenarios for medication errors"
        call: await find_scenarios("medication error")

    See also 👉 scenario_overview() for detailed scenario data.
    """
    pool = get_pool()
    if not pool:
        return [{"error": "Database pool not initialized"}]
    
    async with pool.acquire() as conn:
        return await find_scenarios(conn, query, limit)


# ─────────────────────────────────────────────────────────────────────────────
# ✱ Reports / Analytics Tools (4 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
async def _student_sim_report(profile_id: str, recent: int = 50) -> Dict[str, Any]:
    """
    Deep dive: every attempt, chat, grade, feedback
    Comprehensive student simulation report.

    Input
      • profile_id - UUID of the student profile
      • recent - Limit messages per chat (default: 50)

    Returns
      { "profile": { … }, "attempts": [ … ] }

    Quick-start
      ask:  "Full report on student X"
      call: student_sim_report("uuid-here")

    See also profile_overview() for summary view.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await student_sim_report(conn, profile_id, recent)


@server.tool()
async def _cohort_pass_matrix(cohort_id: str) -> Dict[str, Any]:
    """
    Cohort pass/fail matrix across simulations
    Show pass/fail rates for all students in a cohort.

    Input
      • cohort_id - UUID of the cohort

    Returns
      { "cohort": {…}, "matrix": [{…}], "summary": {…} }

    Quick-start
      ask:  "Show pass rates for cohort X"
      call: cohort_pass_matrix("uuid-here")

    See also cohort_overview() for cohort details.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await cohort_pass_matrix(conn, cohort_id)


@server.tool()
async def _simulation_attempts(sim_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    """
    Flat list of attempts (who, when, score)
    List all attempts for a specific simulation.

    Input
      • sim_id - UUID of the simulation
      • limit - Max results (default: 200)

    Returns
      [ { "id": "…", "student": "…", "score": 85, … }, … ]

    Quick-start
      ask:  "List last 200 attempts on Sim Y"
      call: simulation_attempts("uuid-here")

    See also simulation_overview() for aggregate stats.
    """
    pool = get_pool()
    if not pool:
        return [{"error": "Database pool not initialized"}]
    
    async with pool.acquire() as conn:
        return await simulation_attempts(conn, sim_id, limit)


@server.tool()
async def _persona_response_times(persona_id: str, window_days: int = 30) -> Dict[str, Any]:
    """
    Persona response time analysis
    Analyze response times for a specific persona.

    Input
      • persona_id - UUID of the persona
      • window_days - Analysis window in days (default: 30)

    Returns
      { "persona": {…}, "stats": {…}, "recent_responses": […] }

    Quick-start
      ask:  "How fast does persona X respond?"
      call: persona_response_times("uuid-here")

    See also persona_overview() for persona details.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await persona_response_times(conn, persona_id, window_days)


# ─────────────────────────────────────────────────────────────────────────────
# ✱ Log / Audit Tools (3 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
async def _recent_app_logs(level: str = "error", limit: int = 100) -> List[Dict[str, Any]]:
    """
    🔎 Fetch recent ERROR/WARN app logs
    -----------------------------------
    Recent application logs filtered by level.

    Input
      • level – Log level filter ('error', 'warn', 'info', 'debug')
      • limit – Max results (default: 100)

    Returns
      [ { "id": …, "level": "…", "message": "…", … }, … ]

    Quick-start
      ask:  "Any critical errors today?"
      call: recent_app_logs("error")

    See also 👉 assistant_usage() for assistant-specific logs.
    """
    pool = get_pool()
    if not pool:
        return [{"error": "Database pool not initialized"}]
    
    async with pool.acquire() as conn:
        return await recent_app_logs(conn, level, limit)


@server.tool()
async def _export_csv(sql: str) -> str:
    """
    🔎 Export query results as CSV download
    ---------------------------------------
    Same guard-rails as query_data but returns a downloadable CSV link.

    Input
      • sql – SELECT statement only

    Returns
      Download link for CSV file

    Quick-start
      ask:  "Export roster for Cohort C"
      call: export_csv("SELECT first_name, last_name FROM profiles WHERE ...")

    Security: Only SELECT allowed, 1000-row limit.
    """
    pool = get_pool()
    if not pool:
        return "Error: Database pool not initialized"
    
    async with pool.acquire() as conn:
        return await export_csv(conn, sql)


@server.tool()
async def _assistant_usage(days: int = 7) -> Dict[str, Any]:
    """
    📊 Assistant usage statistics
    -----------------------------
    Show assistant chat usage over time period.

    Input
      • days – Analysis window in days (default: 7)

    Returns
      { "summary": {…}, "daily_stats": […], "top_users": […] }

    Quick-start
      ask:  "Show assistant usage last 7 days"
      call: assistant_usage(7)

    See also 👉 recent_app_logs() for system logs.
    """
    pool = get_pool()
    if not pool:
        return {"error": "Database pool not initialized"}
    
    async with pool.acquire() as conn:
        return await assistant_usage(conn, days)


# ─────────────────────────────────────────────────────────────────────────────
# Server is ready - all 19 tools are implemented and registered
# Complete MCP analytics suite with modular architecture
# ─────────────────────────────────────────────────────────────────────────────
